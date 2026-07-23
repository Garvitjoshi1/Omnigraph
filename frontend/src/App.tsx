import { memo, useState, useEffect, type ReactNode } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type NodeProps,
  type Node as FlowNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Database,
  Network,
  ShieldAlert,
  Search,
  Lock,
  User,
  LogOut,
  ArrowRight,
  Sliders,
  Maximize2,
  Terminal,
  UploadCloud,
  FileText,
  Layers,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  Sparkles,
  RefreshCw,
  Mail,
  Send,
  Cookie,
  Check,
  CreditCard,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { useDashboard, type RiskNode } from "./dashboardContext";
import { useTheme } from "./themeContext";

type ActivePage = "home" | "analysis";

export type ExtendedNode = RiskNode & {
  frequency?: number;
  label?: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
};

// --- Helper Functions for Cookie Storage ---
function setCookie(name: string, value: string, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name: string) {
  return document.cookie.split("; ").reduce((r, v) => {
    const parts = v.split("=");
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, "");
}

// --- Custom Graph Node ---
function MissionControlNode({ data, selected }: NodeProps) {
  const node = data as unknown as ExtendedNode;
  const isHighRisk = (node.risk_score || 0) >= 0.7;

  return (
    <div
      className={`relative px-4 py-3 rounded-xl backdrop-blur-md transition-all font-mono text-xs shadow-2xl ${
        isHighRisk
          ? "bg-[#1f0a0a]/90 border border-amber-500/80 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          : "bg-[#0c121e]/90 border border-cyan-500/50 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
      } ${selected ? "ring-2 ring-violet-500 border-violet-400 scale-105" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-400 !w-2 !h-2"
      />
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          {node.label || "Entity"}
        </span>
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isHighRisk ? "bg-amber-950/80 text-amber-400 border border-amber-800/50" : "bg-cyan-950/80 text-cyan-300 border border-cyan-800/50"}`}
        >
          {Math.round((node.risk_score || 0) * 100)}% RISK
        </span>
      </div>
      <div className="font-bold text-sm tracking-tight text-white">
        {node.name}
      </div>
      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          Freq: <strong className="text-white">{node.frequency || 1}</strong>
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500">
          Node Ref #{node.id?.slice(0, 6)}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-400 !w-2 !h-2"
      />
    </div>
  );
}
const nodeTypes = { supply: MissionControlNode };

export function App() {
  const {
    nodes,
    edges,
    risks,
    sources,
    activeNodeId,
    setActiveNodeId,
    refreshDashboard,
  } = useDashboard();

  // Navigation State
  const [currentPage, setCurrentPage] = useState<ActivePage>("home");

  // Authentication & Gate States
  const [hasProfile, setHasProfile] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    org: "",
  });

  // Cookie States
  const [cookiesAccepted, setCookiesAccepted] = useState<boolean>(false);
  const [showCookieBanner, setShowCookieBanner] = useState<boolean>(false);

  // Freemium Model Tier Limits (3 free file runs)
  const [freeRunsCount, setFreeRunsCount] = useState<number>(0);
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);

  // Analytical States
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [cypher, setCypher] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Contact Form States
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Terminal Logs State
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [logs, setLogs] = useState<
    Array<{
      text: string;
      type: "info" | "success" | "warn" | "error";
      time: string;
    }>
  >([
    {
      text: "OmniGraph Session Engine online.",
      type: "info",
      time: new Date().toLocaleTimeString(),
    },
  ]);

  const addLog = (
    text: string,
    type: "info" | "success" | "warn" | "error" = "info",
  ) => {
    setLogs((prev) => [
      ...prev,
      { text, type, time: new Date().toLocaleTimeString() },
    ]);
  };

  // --- Initialize Cookies & Triggers ---
  useEffect(() => {
    // Check Cookies on load
    const savedConsent = getCookie("omnigraph_cookie_consent");
    if (savedConsent === "true") {
      setCookiesAccepted(true);
    } else {
      setShowCookieBanner(true);
    }

    const savedRuns = getCookie("omnigraph_runs_count");
    if (savedRuns) {
      setFreeRunsCount(parseInt(savedRuns, 10));
    }

    const savedUser = getCookie("omnigraph_user_profile");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUserProfile(parsed);
        setHasProfile(true);
      } catch (e) {
        // Fallback if parsing fails
      }
    }
  }, []);

  // --- 5-Second Delayed Gate Trigger on Analysis Page ---
  useEffect(() => {
    if (currentPage === "analysis" && !hasProfile) {
      const timer = setTimeout(() => {
        setShowProfileModal(true);
        addLog("Security Gate Triggered: Profile creation required.", "warn");
      }, 5000); // Trigger after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [currentPage, hasProfile]);

  const acceptCookies = () => {
    setCookie("omnigraph_cookie_consent", "true", 365);
    setCookiesAccepted(true);
    setShowCookieBanner(false);
    addLog("Cookie preferences saved to browser storage.", "success");
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile.name || !userProfile.email) return;

    setCookie("omnigraph_user_profile", JSON.stringify(userProfile), 30);
    setHasProfile(true);
    setShowProfileModal(false);
    addLog(
      `Profile created for ${userProfile.name}. Full access unlocked.`,
      "success",
    );
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setUploadFiles((prev) => [...prev, ...droppedFiles]);
      addLog(
        `Staged ${droppedFiles.length} file payloads into buffer.`,
        "info",
      );
    }
  };

  async function executeGraphSynthesis() {
    if (!uploadFiles.length) return;

    // Check Freemium Model Limit
    if (freeRunsCount >= 3) {
      setShowPaywallModal(true);
      addLog("Freemium Limit Exceeded: Upstream license required.", "error");
      return;
    }

    setUploading(true);
    addLog(
      "Parsing document matrices and calculating co-occurrence math...",
      "info",
    );

    const formData = new FormData();
    uploadFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Synthesis pipeline failure.");

      const newRunCount = freeRunsCount + 1;
      setFreeRunsCount(newRunCount);
      setCookie("omnigraph_runs_count", newRunCount.toString(), 30);

      addLog(
        `Graph generated successfully! Free run ${newRunCount}/3 consumed.`,
        "success",
      );
      setUploadFiles([]);
      await refreshDashboard();
    } catch (e: any) {
      addLog(`Pipeline Error: ${e.message}`, "error");
    } finally {
      setUploading(false);
    }
  }

  async function askCopilot() {
    if (!question.trim()) return;
    setLoading(true);
    addLog(`Evaluating Graph Copilot prompt: "${question}"`, "info");

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const result = await response.json();
      setAnswer(result.answer);
      setCypher(result.cypher);
      addLog("Copilot analysis completed successfully.", "success");
    } catch (err: any) {
      addLog(`Copilot Error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  const activeSelectedNode = (nodes as unknown as ExtendedNode[]).find(
    (n) => n.id === activeNodeId,
  );

  const graphNodes: FlowNode[] = (nodes as unknown as ExtendedNode[]).map(
    (node) => ({
      id: node.id,
      type: "supply",
      position: { x: node.x || 400, y: node.y || 300 },
      data: node,
      selected: activeNodeId === node.id,
    }),
  );

  const graphEdges = edges.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.relationship,
    type: "simplebezier",
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 1.5 },
    labelStyle: {
      fill: "#a7f3d0",
      fontSize: 9,
      fontFamily: "JetBrains Mono, monospace",
    },
    labelBgStyle: { fill: "#0a0a0a", fillOpacity: 0.95 },
  }));

  return (
    <main className="min-h-screen bg-[#070709] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-300 antialiased overflow-hidden flex flex-col h-screen">
      {/* --- GLOBAL NAVIGATION HEADER --- */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0a0a0d]/90 backdrop-blur-xl px-6 flex items-center justify-between z-40 shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentPage("home")}
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <div className="h-full w-full bg-[#0a0a0d] rounded-[11px] grid place-items-center">
              <span className="font-mono font-black text-cyan-400 text-base">
                O
              </span>
            </div>
          </div>
          <div className="font-mono font-black tracking-widest text-sm bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            OMNIGRAPH
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 font-mono text-xs">
          <button
            onClick={() => setCurrentPage("home")}
            className={`transition-colors ${currentPage === "home" ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
          >
            Home
          </button>
          <button
            onClick={() => setCurrentPage("analysis")}
            className={`transition-colors ${currentPage === "analysis" ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
          >
            Services Workspace
          </button>
        </div>

        {/* Profile Status Badge */}
        <div className="flex items-center gap-4 font-mono text-xs">
          {hasProfile ? (
            <div className="flex items-center gap-2 bg-[#11131c] border border-slate-800/80 px-3 py-1.5 rounded-xl">
              <User size={12} className="text-cyan-400" />
              <span className="text-slate-200 font-bold">
                {userProfile.name}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setShowProfileModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-violet-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs"
            >
              Create Profile
            </button>
          )}
        </div>
      </header>

      {/* --- PAGE 1: PUBLIC HOME PAGE --- */}
      {currentPage === "home" && (
        <div className="flex-1 overflow-y-auto font-mono">
          {/* Hero Section */}
          <section className="max-w-5xl mx-auto px-6 py-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-800 bg-[#0b0e17] text-[10px] uppercase tracking-widest text-cyan-400 mb-6">
              <Zap size={10} /> Neural Knowledge Network Platform
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none uppercase">
              Transform Dark Data Into{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                Relational Topology.
              </span>
            </h1>
            <p className="mt-6 text-slate-400 max-w-2xl mx-auto font-sans text-sm leading-relaxed">
              OmniGraph ingests unstructured PDF contracts, database dumps, and
              communication logs, computing co-occurrence frequencies to build
              dynamic, Obsidian-style semantic webs automatically.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={() => setCurrentPage("analysis")}
                className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all shadow-lg flex items-center gap-2"
              >
                Launch Services Engine <ArrowRight size={14} />
              </button>
            </div>
          </section>

          {/* Section: What We Do */}
          <section className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-8 text-center">
              What We Do
            </h2>
            <div className="grid gap-6 md:grid-cols-3 font-sans text-xs">
              <div className="bg-[#0b0e17] border border-slate-800/80 p-6 rounded-2xl">
                <Database className="text-cyan-400 mb-3" size={20} />
                <h3 className="font-mono font-bold text-slate-200 uppercase text-sm mb-2">
                  1. Ingestion
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Parse text streams from PDFs, JSON logs, CSVs, and SQLite
                  database tables with zero manual preprocessing rules.
                </p>
              </div>
              <div className="bg-[#0b0e17] border border-slate-800/80 p-6 rounded-2xl">
                <Layers className="text-cyan-400 mb-3" size={20} />
                <h3 className="font-mono font-bold text-slate-200 uppercase text-sm mb-2">
                  2. Matrix Calculation
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Extract core keywords, calculate density intersections, and
                  build weighted relationship paths automatically.
                </p>
              </div>
              <div className="bg-[#0b0e17] border border-slate-800/80 p-6 rounded-2xl">
                <Sparkles className="text-cyan-400 mb-3" size={20} />
                <h3 className="font-mono font-bold text-slate-200 uppercase text-sm mb-2">
                  3. Graph Copilot
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Execute conversational queries against your live data map,
                  generating clean analytical answers and deterministic Cypher
                  traces.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Services Offered */}
          <section className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-8 text-center">
              Our Capabilities & Services
            </h2>
            <div className="grid gap-4 md:grid-cols-2 font-mono text-xs">
              <div className="bg-[#0b0e17] border border-slate-800/80 p-5 rounded-xl flex items-start gap-4">
                <Activity size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-200">
                    Zero-Shot Semantic Disambiguation
                  </h4>
                  <p className="text-slate-400 font-sans text-[11px] mt-1">
                    Normalizes entity names across files to resolve duplicates
                    into a single node.
                  </p>
                </div>
              </div>
              <div className="bg-[#0b0e17] border border-slate-800/80 p-5 rounded-xl flex items-start gap-4">
                <ShieldAlert
                  size={18}
                  className="text-amber-400 shrink-0 mt-0.5"
                />
                <div>
                  <h4 className="font-bold text-slate-200">
                    Contextual Anomaly Calculation
                  </h4>
                  <p className="text-slate-400 font-sans text-[11px] mt-1">
                    Evaluates risk metrics ($0.0$ to $1.0$) based on source
                    evidence snippets.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Contact Us */}
          <section className="max-w-2xl mx-auto px-6 py-16 border-t border-slate-800/80 mb-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 text-center">
              Contact Us
            </h2>
            <p className="text-slate-400 text-center font-sans text-xs mb-8">
              Interested in custom enterprise integrations or dedicated cluster
              pipelines? Send us a message.
            </p>

            {contactSubmitted ? (
              <div className="bg-emerald-950/40 border border-emerald-800/50 p-6 rounded-2xl text-center text-emerald-400 text-xs">
                <CheckCircle2 size={24} className="mx-auto mb-2" />
                Thank you! Your message has been routed to our engineering team.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setContactSubmitted(true);
                }}
                className="space-y-4 font-mono text-xs"
              >
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">
                    Name
                  </label>
                  <input
                    required
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    className="w-full bg-[#0b0e17] border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">
                    Corporate Email
                  </label>
                  <input
                    required
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    className="w-full bg-[#0b0e17] border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">
                    Message
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={contactForm.message}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        message: e.target.value,
                      })
                    }
                    className="w-full bg-[#0b0e17] border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-cyan-500 text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={12} /> Transmit Message
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* --- PAGE 2: SERVICES & ANALYSIS WORKSPACE --- */}
      {currentPage === "analysis" && (
        <div className="flex-1 grid grid-cols-[240px_1fr_360px] overflow-hidden relative">
          {/* LEFT SLENDER PANEL */}
          <aside className="border-r border-slate-800/80 bg-[#0a0a0d]/90 backdrop-blur-md p-4 flex flex-col justify-between font-mono text-xs z-10">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <Activity size={12} className="text-cyan-400" /> Session
                Telemetry
              </div>

              {/* Freemium Usage Meter */}
              <div className="bg-[#11131c] border border-slate-800/80 rounded-xl p-3 mb-6">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-2">
                  <span>Free Files Synthesized</span>
                  <span className="font-bold text-cyan-400">
                    {freeRunsCount} / 3
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                    style={{ width: `${(freeRunsCount / 3) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-[#11131c]/50 border border-slate-800/60 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">
                    Ingested Files
                  </span>
                  <span className="font-bold text-slate-200">
                    {sources.length}
                  </span>
                </div>
                <div className="bg-[#11131c]/50 border border-slate-800/60 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">
                    Active Entities
                  </span>
                  <span className="font-bold text-slate-200">
                    {nodes.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
              Gemini 2.0 Flash Engine Active
            </div>
          </aside>

          {/* CENTER HERO CANVAS */}
          <section className="relative flex-1 bg-[#050508] overflow-hidden flex flex-col">
            {/* Header Copilot Input */}
            <div className="p-3 bg-[#0a0a0d] border-b border-slate-800 flex items-center gap-3">
              <Search size={16} className="text-cyan-400 shrink-0" />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askCopilot()}
                placeholder="Ask Graph Copilot (e.g., 'Trace high-variance nodes')..."
                className="w-full bg-transparent text-xs outline-none text-slate-200 font-mono"
              />
              <button
                onClick={askCopilot}
                disabled={loading}
                className="bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg shrink-0"
              >
                {loading ? "Calculating..." : "Query"}
              </button>
            </div>

            {/* Answer Display */}
            {answer && (
              <div className="z-20 bg-[#0d111c]/95 border-b border-slate-800/80 backdrop-blur-xl p-4 font-mono text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Sparkles size={12} /> Graph Copilot Impact Trace
                  </span>
                  <button
                    onClick={() => setAnswer("")}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">
                  {answer}
                </p>
                {cypher && (
                  <div className="mt-2 p-2 bg-[#05070f] border border-slate-800 rounded font-mono text-[10px] text-cyan-300 flex items-center justify-between">
                    <code>{cypher}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(cypher)}
                      className="text-slate-500 hover:text-cyan-400"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* React Flow Topology Frame */}
            <div className="flex-1 relative">
              <ReactFlow
                nodes={graphNodes}
                edges={graphEdges}
                nodeTypes={nodeTypes}
                fitView
                onNodeClick={(_, n) => setActiveNodeId(n.id)}
                onPaneClick={() => setActiveNodeId(null)}
                nodesDraggable
                nodesConnectable={false}
                elementsSelectable
              >
                <Background color="#161b26" gap={24} size={1} />
                <Controls
                  showInteractive={false}
                  className="!bg-[#0a0a0d] !border-slate-800 !shadow-2xl"
                />
              </ReactFlow>
            </div>
          </section>

          {/* RIGHT PANEL (INSPECTOR / DROP ZONE) */}
          <aside className="border-l border-slate-800/80 bg-[#0a0a0d]/90 backdrop-blur-md p-5 flex flex-col justify-between font-mono text-xs z-10">
            {activeSelectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Layers size={12} /> Context Inspector
                  </span>
                  <button
                    onClick={() => setActiveNodeId(null)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">
                    Identifier
                  </label>
                  <div className="text-sm font-bold text-white font-sans">
                    {activeSelectedNode.name}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">
                    Quote Evidence
                  </label>
                  <div className="bg-[#05070f] border border-slate-800 p-3 rounded-xl text-slate-300 font-sans text-xs italic">
                    "{activeSelectedNode.evidence || "No evidence quote found."}
                    "
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <UploadCloud size={14} className="text-cyan-400" /> Smart
                    Ingestion Zone
                  </div>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    className="border-2 border-dashed rounded-2xl p-6 text-center border-slate-800 bg-[#070a12]"
                  >
                    <UploadCloud
                      size={28}
                      className="mx-auto text-slate-500 mb-3"
                    />
                    <div className="font-bold text-slate-200 text-xs">
                      Drop Data Files Here
                    </div>
                    <label
                      htmlFor="workspace-file"
                      className="mt-4 inline-block bg-[#11131c] border border-slate-800 text-slate-300 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      Browse Files
                    </label>
                    <input
                      id="workspace-file"
                      type="file"
                      multiple
                      accept=".pdf,.json,.csv,.txt,.sqlite,.db"
                      onChange={(e) =>
                        e.target.files &&
                        setUploadFiles(Array.from(e.target.files))
                      }
                      className="hidden"
                    />
                  </div>

                  {uploadFiles.length > 0 && (
                    <div className="mt-4">
                      <div className="text-[9px] uppercase text-slate-500 mb-2 font-bold">
                        Staged Files ({uploadFiles.length})
                      </div>
                      {uploadFiles.map((f, i) => (
                        <div
                          key={i}
                          className="flex justify-between bg-[#11131c] border border-slate-800 p-2 rounded text-[10px] mb-1"
                        >
                          <span className="truncate text-slate-300">
                            {f.name}
                          </span>
                          <button
                            onClick={() =>
                              setUploadFiles(
                                uploadFiles.filter((_, idx) => idx !== i),
                              )
                            }
                            className="text-slate-500 hover:text-red-400"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={executeGraphSynthesis}
                  disabled={uploading || uploadFiles.length === 0}
                  className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-violet-600 text-slate-950 font-black text-xs uppercase py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  {uploading ? "Synthesizing..." : "⟳ SYNTHESIZE GRAPH"}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* --- MODAL 1: MANDATORY PROFILE CREATION GATE (After 5 Secs) --- */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md grid place-items-center p-4"
          >
            <div className="bg-[#0c0f1d] border border-cyan-500/50 p-8 rounded-2xl max-w-md w-full shadow-[0_0_30px_rgba(6,182,212,0.2)] font-mono">
              <div className="text-center mb-6">
                <div className="h-12 w-12 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50 grid place-items-center mx-auto mb-3">
                  <User size={20} />
                </div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Establish User Profile
                </h3>
                <p className="text-slate-400 font-sans text-xs mt-1">
                  Create your profile to unlock continuous workspace graph
                  parsing.
                </p>
              </div>
              <form
                onSubmit={handleProfileSubmit}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">
                    Full Name
                  </label>
                  <input
                    required
                    type="text"
                    value={userProfile.name}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, name: e.target.value })
                    }
                    className="w-full bg-[#05070f] border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-cyan-500"
                    placeholder="e.g. Garvit Joshi"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">
                    Corporate Email
                  </label>
                  <input
                    required
                    type="email"
                    value={userProfile.email}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, email: e.target.value })
                    }
                    className="w-full bg-[#05070f] border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-cyan-500"
                    placeholder="garvit@lpu.in"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-cyan-500 text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs hover:bg-cyan-400 transition-colors"
                >
                  Instantiate Profile & Access Workspace
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: FREEMIUM PAYWALL GATE (Triggered after 3 runs) --- */}
      <AnimatePresence>
        {showPaywallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md grid place-items-center p-4"
          >
            <div className="bg-[#0c0f1d] border border-violet-500/50 p-8 rounded-2xl max-w-md w-full shadow-[0_0_30px_rgba(139,92,246,0.3)] font-mono text-center">
              <div className="h-12 w-12 rounded-full bg-violet-950 text-violet-400 border border-violet-800/50 grid place-items-center mx-auto mb-3">
                <CreditCard size={20} />
              </div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Free Limit Consumed
              </h3>
              <p className="text-slate-400 font-sans text-xs mt-2 leading-relaxed">
                You have reached your 3-file free synthesis limit. Upgrade to{" "}
                <strong className="text-violet-400">OmniGraph Premium</strong>{" "}
                for uncapped file parsing and persistent storage.
              </p>
              <div className="my-6 bg-[#05070f] border border-slate-800 p-4 rounded-xl text-left font-sans text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-200">
                  <Check size={14} className="text-cyan-400" /> Infinite Dynamic
                  Graph Builds
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <Check size={14} className="text-cyan-400" /> Multi-Agent
                  Cypher Execution Loops
                </div>
              </div>
              <button
                onClick={() =>
                  alert("Redirecting to Stripe payment gateway...")
                }
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs"
              >
                Scale Infrastructure Tier ($49/mo)
              </button>
              <button
                onClick={() => setShowPaywallModal(false)}
                className="mt-3 text-[10px] text-slate-500 hover:text-slate-300 uppercase"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- COOKIE CONSENT BANNER --- */}
      <AnimatePresence>
        {showCookieBanner && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-14 left-6 right-6 z-40 max-w-2xl mx-auto bg-[#0c0f1d]/95 border border-cyan-500/40 p-4 rounded-2xl backdrop-blur-xl shadow-2xl font-mono text-xs flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Cookie size={20} className="text-cyan-400 shrink-0" />
              <p className="text-slate-300 font-sans text-xs leading-normal">
                We use browser cookies to persist your session profile,
                analytical graph run balances, and workspace state.
              </p>
            </div>
            <button
              onClick={acceptCookies}
              className="bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shrink-0 hover:bg-cyan-400 transition-colors"
            >
              Accept Cookies
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BOTTOM LOGS TERMINAL DRAWER --- */}
      <footer className="border-t border-slate-800/80 bg-[#07070a] z-30 shrink-0 font-mono text-xs">
        <div className="px-4 py-2 bg-[#0a0a0d] border-b border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal size={12} className="text-cyan-400" />
            <span className="font-bold uppercase tracking-wider text-slate-300">
              Engine Live Terminal
            </span>
          </div>
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className="text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            {isTerminalOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
          </button>
        </div>
        {isTerminalOpen && (
          <div className="p-3 h-24 overflow-y-auto font-mono text-[11px] space-y-1 bg-[#050508]">
            {logs.map((log, i) => (
              <div key={i} className="flex items-baseline gap-3">
                <span className="text-slate-600 text-[9px] shrink-0">
                  {log.time}
                </span>
                <span
                  className={
                    log.type === "success"
                      ? "text-emerald-400"
                      : log.type === "error"
                        ? "text-red-400"
                        : log.type === "warn"
                          ? "text-amber-400"
                          : "text-slate-300"
                  }
                >
                  {log.type === "success" && "✔ "}
                  {log.type === "error" && "✖ "}
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </footer>
    </main>
  );
}

export default App;
