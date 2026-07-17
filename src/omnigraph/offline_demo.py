"""No-cost, local product mode for demos without cloud API or database access.

It represents the same normalized graph contract used by the Neo4j integration,
so switching infrastructure does not change what the Streamlit UI displays.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DemoNode:
    id: str
    label: str
    name: str
    risk_score: float
    evidence: str


@dataclass(frozen=True)
class DemoEdge:
    source: str
    target: str
    relationship: str


# CODEX_DECISION: A deterministic local fixture graph makes the hackathon
# experience fully demonstrable with zero API credits and no server setup.
DEMO_NODES = [
    DemoNode("supplier:northstar", "Supplier", "NorthStar Components", 0.91, "Customs hold on shipment NS-884; ETA slipped about 48 hours."),
    DemoNode("shipment:NS-884", "Shipment", "Container NS-884", 0.96, "Status note contains customs paperwork hold."),
    DemoNode("product:pump-ax9", "Component", "PUMP-AX9", 0.82, "Only 0.8 days of assembly buffer remain."),
    DemoNode("product:hydralift-b", "Product", "HydraLift B (Product B)", 0.78, "Assembly depends on PUMP-AX9."),
    DemoNode("supplier:acme", "Supplier", "Acme Steel", 0.54, "Frame shipment was reported late at Plant 2."),
]
DEMO_EDGES = [
    DemoEdge("supplier:northstar", "shipment:NS-884", "SHIPS"),
    DemoEdge("shipment:NS-884", "product:pump-ax9", "AFFECTS"),
    DemoEdge("product:pump-ax9", "product:hydralift-b", "DEPENDS_ON"),
    DemoEdge("supplier:acme", "product:hydralift-b", "SUPPLIES"),
]


def source_status(raw_directory: Path) -> list[dict[str, str]]:
    """Expose generated dark-data inputs as an actual ingestion status list."""
    expected = {
        "logistics_operations_dump.sqlite": "Logistics database",
        "northstar_supplier_contract.pdf": "Supplier contract PDF",
        "internal_slack_export.json": "Internal Slack export",
    }
    return [{"source": label, "file": filename, "status": "Ready" if (raw_directory / filename).exists() else "Missing"} for filename, label in expected.items()]


def answer_question(question: str) -> tuple[str, str]:
    """Answer the demo's main impact-analysis questions without an LLM."""
    normalized = question.lower()
    if any(token in normalized for token in ("northstar", "supplier", "delay", "product b", "hydralift", "pump")):
        answer = ("NorthStar's customs delay on NS-884 risks PUMP-AX9 availability. "
                  "HydraLift B depends on that component and has only 0.8 days of buffer, "
                  "so the delay is a high-priority assembly risk.")
        cypher = "MATCH p=(s:Supplier {id: 'supplier:northstar'})-[*1..3]->(product:Product {id: 'product:hydralift-b'}) RETURN p"
        return answer, cypher
    return ("The offline graph tracks supplier, shipment, component, and product dependencies. Try NorthStar, delays, PUMP-AX9, or Product B.", "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50")


def graphviz_dot() -> str:
    """Return a dependency visualization accepted directly by Streamlit."""
    labels = {node.id: node.name for node in DEMO_NODES}
    lines = ["digraph OmniGraph {", "rankdir=LR;", "node [shape=box style=rounded];"]
    for node in DEMO_NODES:
        color = "#e74c3c" if node.risk_score >= 0.8 else "#f39c12"
        lines.append(f'"{node.id}" [label="{labels[node.id]}\\nRisk: {node.risk_score:.0%}" color="{color}"];')
    for edge in DEMO_EDGES:
        lines.append(f'"{edge.source}" -> "{edge.target}" [label="{edge.relationship}"];')
    return "\n".join(lines + ["}"])
