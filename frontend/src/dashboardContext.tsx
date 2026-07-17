import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type RiskNode = { id: string; label: string; name: string; risk_score: number; evidence: string };
export type GraphEdge = { source: string; target: string; relationship: string };
export type Source = { source: string; file: string; status: string; analysis?: string };
type DashboardState = { nodes: RiskNode[]; edges: GraphEdge[]; risks: RiskNode[]; sources: Source[]; activeNodeId: string | null; setActiveNodeId: (id: string | null) => void; refreshDashboard: () => Promise<void> };

const DashboardContext = createContext<DashboardState | undefined>(undefined);

// CODEX_DECISION: Context centralizes data and the graph/risk-list hover state
// without adding a state-management dependency to this focused dashboard.
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<RiskNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const refreshDashboard = async () => {
    try {
      const response = await fetch("/api/dashboard");
      const data = await response.json();
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
      setSources(data.sources ?? []);
    } catch {
      // Keep the current dashboard state on failure.
    }
  };

  useEffect(() => { void refreshDashboard(); }, []);
  const value = useMemo(() => ({ nodes, edges, risks: [...nodes].sort((a, b) => b.risk_score - a.risk_score), sources, activeNodeId, setActiveNodeId, refreshDashboard }), [nodes, edges, sources, activeNodeId]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
export function useDashboard() { const context = useContext(DashboardContext); if (!context) throw new Error("useDashboard must be inside DashboardProvider"); return context; }
