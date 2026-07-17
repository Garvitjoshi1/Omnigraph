import { memo, useState, type ReactNode } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Bolt, Box, Database, FileText, Network, Search, ShieldAlert, Slack, Sparkles } from "lucide-react";
import { useDashboard, type RiskNode } from "./dashboardContext";
import { useTheme, type ThemeMode } from "./themeContext";

const positions: Record<string, { x: number; y: number }> = { "supplier:northstar": { x: 10, y: 45 }, "shipment:NS-884": { x: 205, y: 135 }, "product:pump-ax9": { x: 435, y: 45 }, "supplier:acme": { x: 225, y: 275 }, "product:hydralift-b": { x: 640, y: 185 } };
const riskClass = (score: number) => score >= .9 ? "border-critical" : score >= .75 ? "border-warning" : "border-mint/60";

function SupplyNode({ data, selected }: NodeProps) {
  const node = data as unknown as RiskNode;
  return <motion.div animate={node.risk_score >= .95 ? { boxShadow: ["0 0 0 0 rgba(255,107,107,.3)", "0 0 0 12px rgba(255,107,107,0)", "0 0 0 0 rgba(255,107,107,.3)"] } : {}} transition={{ duration: 2.4, repeat: Infinity }} className={`min-w-[144px] rounded-xl border bg-[#10231d] px-3 py-2.5 shadow-xl ${riskClass(node.risk_score)} ${selected ? "ring-2 ring-mint" : ""}`}><Handle type="target" position={Position.Left}/><span className="node-label">{node.label}</span><strong className="mt-1 block text-xs text-white">{node.name.replace(" Components", "").replace(" (Product B)", "")}</strong><small className={node.risk_score >= .9 ? "text-critical" : node.risk_score >= .75 ? "text-warning" : "text-mint"}>Risk {Math.round(node.risk_score * 100)}%</small><Handle type="source" position={Position.Right}/></motion.div>;
}
const nodeTypes = { supply: SupplyNode };

const RiskRow = memo(function RiskRow({ node, index }: { node: RiskNode; index: number }) {
  const { activeNodeId, setActiveNodeId } = useDashboard();
  const danger = node.risk_score >= .9 ? "bg-critical" : node.risk_score >= .75 ? "bg-warning" : "bg-mint";
  return <motion.div onMouseEnter={() => setActiveNodeId(node.id)} onMouseLeave={() => setActiveNodeId(null)} whileHover={{ x: 4 }} className={`grid grid-cols-[28px_minmax(0,1fr)_82px] items-center gap-3 border-b border-line/70 py-3 last:border-0 ${activeNodeId === node.id ? "rounded-lg bg-mint/10 px-2" : ""}`}><span className="font-mono text-[10px] text-muted">0{index + 1}</span><div className="min-w-0"><strong className="block text-xs">{node.name}</strong><small className="mt-1 block truncate text-[10px] text-muted">{node.evidence}</small></div><div><span className="text-xs font-bold">{Math.round(node.risk_score * 100)}%</span><div aria-label={`${node.name} risk score ${Math.round(node.risk_score * 100)} percent`} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-forest"><motion.i initial={{ width: 0 }} animate={{ width: `${node.risk_score * 100}%` }} transition={{ duration: .65, delay: index * .08 }} className={`block h-full rounded-full ${danger}`}/></div></div></motion.div>;
});

function Stat({ icon, value, label, live }: { icon: ReactNode; value: string | number; label: string; live?: boolean }) { return <motion.div whileHover={{ y: -3 }} className="card p-5"><div className="mb-4 flex items-center justify-between text-mint">{icon}{live && <span className="flex items-center gap-1.5 text-[10px] text-mint"><i className="h-2 w-2 animate-live rounded-full bg-mint"/>LIVE</span>}</div><strong className="text-4xl font-bold tracking-tight text-mint">{value}</strong><span className="mt-1 block text-xs text-muted">{label}</span></motion.div> }

function App() {
  const { nodes, edges, risks, sources, activeNodeId, setActiveNodeId, refreshDashboard } = useDashboard();
  const { mode, setMode } = useTheme();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [cypher, setCypher] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ file: string; status: string; analysis: string }[] | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const graphNodes = nodes.map((node) => ({ id: node.id, type: "supply", position: positions[node.id] ?? { x: 0, y: 0 }, data: node, selected: activeNodeId === node.id }));
  const graphEdges = edges.map((edge) => ({ id: `${edge.source}-${edge.target}`, source: edge.source, target: edge.target, label: edge.relationship, markerEnd: { type: MarkerType.ArrowClosed, color: "#5e927b" }, labelStyle: { fill: "#91d9b2", fontSize: 9, fontWeight: 700 }, labelBgStyle: { fill: "#132a23", fillOpacity: .8 } }));
  async function askGraph() { if (!question.trim()) return; setLoading(true); await new Promise((resolve) => setTimeout(resolve, 1500)); const response = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }); const result = await response.json(); setAnswer(result.answer); setCypher(result.cypher); setLoading(false); }

  async function uploadSources() {
    if (!uploadFiles?.length) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    Array.from(uploadFiles).forEach((file) => formData.append("files", file));
    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.message || "Upload failed.");
      setUploadResult(data.uploads ?? []);
      setUploadMessage(data.message ?? "Files uploaded successfully.");
      setUploadFiles(null);
      await refreshDashboard();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      setUploadResult(null);
      setUploadMessage(null);
    } finally {
      setUploading(false);
    }
  }

  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  const selectedFilesLabel = uploadFiles ? Array.from(uploadFiles).map((file) => file.name).join(", ") : "Choose data files";
  return <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_80%_0%,rgba(33,88,69,.32),transparent_33%),#081c17]">
    <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-line/70 bg-forest/80 px-6 backdrop-blur-xl md:px-12"><div className="flex items-center gap-2 text-lg font-extrabold text-mint"><span className="text-3xl">◇</span> OmniGraph</div><div className="flex items-center gap-5"><span className="hidden items-center gap-2 text-xs text-[#c3d5cc] sm:flex"><i className="h-2 w-2 animate-live rounded-full bg-mint"/>System operational</span><div className="hidden items-center gap-2 rounded-full border border-line bg-[#0f2b1e]/80 px-3 py-1 text-[10px] text-muted sm:flex">
        {themeOptions.map((option) => (
          <button key={option.value} type="button" onClick={() => setMode(option.value)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${mode === option.value ? "bg-mint text-forest" : "text-muted hover:text-mint"}`}>
            {option.label}
          </button>
        ))}
      </div><span className="grid h-9 w-9 place-items-center rounded-full bg-[#d0ebcb] text-xs font-bold text-forest">GG</span></div></nav>
    <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-14 md:px-10 lg:px-14"><section className="grid items-end gap-8 lg:grid-cols-[1fr_360px]"><div><p className="eyebrow">AUTONOMOUS DATA ORCHESTRATION</p><h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-.045em] sm:text-6xl">Turn dark data into <span className="text-mint">operational clarity.</span></h1><p className="mt-5 max-w-2xl text-sm leading-7 text-muted">An enterprise intelligence layer that connects supplier signals, shipment risks, and downstream product impact.</p></div><motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }} className="animate-breathe rounded-2xl border border-critical/50 bg-panel p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mint text-forest"><Bolt size={21} fill="currentColor"/></span><div className="min-w-0 flex-1"><p className="text-[11px] text-muted">Most critical signal</p><strong className="mt-1 block text-sm">NS-884 customs hold</strong><small className="mt-1 block text-[11px] text-muted">Propagating risk to HydraLift B</small></div><b className="text-3xl text-critical">96%</b></div></motion.div></section>
      <section className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat icon={<Database size={18}/>} value="3" label="Dark-data sources"/><Stat icon={<Network size={18}/>} value="5" label="Connected entities"/><Stat icon={<ShieldAlert size={18}/>} value="3" label="Critical risks"/><Stat icon={<Activity size={18}/>} value="Live" label="AI orchestration" live/></section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.85fr]"><div className="card p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">KNOWLEDGE GRAPH</p><h2 className="text-xl font-bold">Supply chain topology</h2></div><span className="rounded-full border border-line bg-forest px-3 py-1.5 text-[10px] text-mint"><Sparkles className="mr-1 inline" size={12}/>Offline demo</span></div><div className="mt-5 h-[390px] rounded-xl border border-line/70 bg-[#0b1915]"><ReactFlow nodes={graphNodes} edges={graphEdges} nodeTypes={nodeTypes} fitView onNodeClick={(_, node) => setActiveNodeId(node.id)} onPaneClick={() => setActiveNodeId(null)} nodesDraggable nodesConnectable={false} elementsSelectable><Background color="#1e3d32" gap={22}/><Controls showInteractive={false}/></ReactFlow></div><div className="mt-4 flex gap-5 text-[11px] text-muted"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-critical"/>Critical risk</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-warning"/>Monitored</span></div></div>
        <div className="card p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">PREDICTIVE ANALYTICS</p><h2 className="text-xl font-bold">Failure risk radar</h2></div><button className="text-xs text-mint">View report →</button></div><div className="mt-4">{risks.map((node, index) => <RiskRow node={node} index={index} key={node.id}/>)}</div></div></section>
      <section className="mt-5 rounded-2xl border border-line bg-[linear-gradient(110deg,#123429,#10231d)] p-6"><div className="grid gap-6 lg:grid-cols-[.8fr_1.4fr]"><div><p className="eyebrow">GRAPH COPILOT</p><h2 className="text-2xl font-bold">Ask your operations data.</h2><p className="mt-3 text-sm leading-6 text-muted">Trace a disruption from supplier signal to customer impact in one question.</p></div><div className="self-center"><div className="flex h-14 items-center gap-3 rounded-xl border border-mint/40 bg-forest px-4"><Search size={19} className="text-mint"/><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && askGraph()} placeholder="How does the delay at NorthStar affect Product B?" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"/><button onClick={askGraph} disabled={loading} className="rounded-lg bg-mint px-4 py-2 text-xs font-extrabold text-forest transition hover:bg-white disabled:opacity-60">{loading ? "Analysing…" : "Ask graph"}</button></div>{answer && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-[#0a1915] p-4"><strong className="text-xs text-mint">Impact analysis</strong><p className="mt-2 text-sm leading-6 text-[#d5e1db]">{answer}</p><code className="mt-3 block overflow-x-auto rounded-lg bg-[#07110e] p-3 text-[10px] text-[#9edec3]">{cypher}</code></motion.div>}</div></div></section>
      <section className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_.85fr]"><div className="card p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">DATA UPLOAD</p><h2 className="text-xl font-bold">Upload customer data</h2><p className="mt-3 text-sm leading-6 text-muted">Upload PDF, JSON, CSV, TXT, SQLite, or DB files for analysis and downstream extraction.</p></div><span className="rounded-full border border-line bg-forest px-3 py-1.5 text-[10px] text-mint">Supports web uploads</span></div><div className="mt-5 space-y-4"><label className="block text-[11px] font-semibold uppercase tracking-[.18em] text-muted" htmlFor="upload-files">Select files</label><input id="upload-files" type="file" multiple accept=".pdf,.json,.csv,.txt,.sqlite,.db" onChange={(event) => setUploadFiles(event.target.files)} className="w-full rounded-xl border border-line bg-[#07110e] px-4 py-3 text-sm text-white outline-none" /><div className="flex flex-wrap items-center gap-3"><button onClick={uploadSources} disabled={uploading || !uploadFiles?.length} className="rounded-lg bg-mint px-4 py-2 text-xs font-extrabold text-forest transition hover:bg-white disabled:opacity-60">{uploading ? "Uploading…" : "Upload files"}</button><span className="text-[10px] text-muted">{selectedFilesLabel}</span></div>{uploadError && <div className="rounded-xl border border-critical/50 bg-[#2f1317] p-3 text-[11px] text-critical">{uploadError}</div>}{uploadMessage && <div className="rounded-xl border border-mint/40 bg-[#102a1f] p-3 text-[11px] text-mint">{uploadMessage}</div>}{uploadResult && uploadResult.length > 0 && <div className="space-y-3 pt-3"><strong className="block text-xs text-mint">Upload results</strong>{uploadResult.map((item) => <div key={item.file} className="rounded-xl border border-line/70 bg-[#081611] p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.file}</strong><span className="text-[10px] text-mint">{item.status}</span></div><p className="mt-2 text-[11px] text-muted">{item.analysis}</p></div>)}</div>}</div></div><div className="card p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">THEME MODE</p><h2 className="text-xl font-bold">Dark, light, or system</h2><p className="mt-3 text-sm leading-6 text-muted">Choose the display mode that fits your workflow.</p></div><span className="rounded-full border border-line bg-forest px-3 py-1.5 text-[10px] text-mint">Current: {mode}</span></div><div className="mt-5 flex flex-wrap gap-3">{themeOptions.map((option) => (<button key={option.value} type="button" onClick={() => setMode(option.value)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${mode === option.value ? "bg-mint text-forest" : "border border-line bg-[#081611] text-muted hover:border-mint hover:text-white"}`}>{option.label}</button>))}</div></div></section>
      <section className="mt-7 border-t border-line pt-6"><p className="eyebrow">INGESTION PIPELINE</p><h2 className="text-xl font-bold">Source health</h2><div className="mt-5 grid gap-3 md:grid-cols-3">{sources.map((source, index) => <motion.div whileHover={{ y: -2 }} className="card flex items-center gap-3 p-4" key={source.file}>{index === 0 ? <Database className="text-mint"/> : index === 1 ? <FileText className="text-mint"/> : <Slack className="text-mint"/>}<div className="min-w-0 flex-1"><strong className="block text-xs">{source.source}</strong><small className="mt-1 block truncate text-[10px] text-muted">{source.file}</small></div><span className="text-[10px] text-mint"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-mint"/>{source.status}</span></motion.div>)}</div></section>
    </div></main>;
}
export default App;
