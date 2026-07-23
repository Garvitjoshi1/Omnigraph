import sys
import json
import sqlite3
import re
import math
from typing import List, Dict, Any
from pathlib import Path
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from pypdf import PdfReader

# Dynamically bind workspace root
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

client = genai.Client()

# ----------------------------------------------------------------------
# 1. GraphRAG Domain Schemas
# ----------------------------------------------------------------------
class GraphEntity(BaseModel):
    id: str = Field(description="Unique lowercase identifier, e.g., 'vendor:tsmc', 'part:chip_a1', 'product:server_x'")
    label: str = Field(description="Category: 'Vendor', 'Component', 'Product', 'Logistics', 'Contract'")
    name: str = Field(description="Formal clean name of the entity")
    risk_score: float = Field(description="Direct operational risk score from 0.0 (nominal) to 1.0 (critical failure)")
    evidence: str = Field(description="Snippet or factual rationale from data supporting this risk score")

class GraphRelation(BaseModel):
    source: str = Field(description="ID of source entity")
    target: str = Field(description="ID of target entity")
    relationship: str = Field(description="Directional link: 'SUPPLIES', 'DEPENDS_ON', 'DELAYED_BY', 'AFFECTS'")

class GraphRAGExtraction(BaseModel):
    nodes: List[GraphEntity]
    edges: List[GraphRelation]

# ----------------------------------------------------------------------
# 2. File Extractor Parsing Engine
# ----------------------------------------------------------------------
def extract_raw_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return "\n".join([page.extract_text() or "" for page in PdfReader(file_path).pages])
    elif suffix in [".json", ".csv", ".txt", ".md"]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif suffix in [".sqlite", ".db"]:
        conn = sqlite3.connect(file_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        dump = []
        for t in tables:
            cursor.execute(f"SELECT * FROM {t} LIMIT 20;")
            dump.append(f"Table {t}: {cursor.fetchall()}")
        conn.close()
        return "\n".join(dump)
    return ""

# ----------------------------------------------------------------------
# 3. Risk Propagation Engine (Mathematical Network Graph Calculations)
# ----------------------------------------------------------------------
def propagate_graph_risks(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Graph Algorithm: Propagates upstream risk scores down dependency chains.
    If Node A (Risk 0.95) SUPPLIES Node B (Risk 0.1), Node B's risk escalates.
    """
    node_map = {n["id"]: n for n in nodes}
    
    # Run 2 passes to propagate multi-hop risks across the network topology
    for _ in range(2):
        for edge in edges:
            src_id = edge["source"]
            tgt_id = edge["target"]
            
            if src_id in node_map and tgt_id in node_map:
                src_risk = node_map[src_id].get("risk_score", 0.0)
                tgt_risk = node_map[tgt_id].get("risk_score", 0.0)
                
                # If target depends on high-risk source, propagate 85% of source risk
                propagated_risk = round(src_risk * 0.85, 2)
                if propagated_risk > tgt_risk:
                    node_map[tgt_id]["risk_score"] = propagated_risk
                    if "Propagated risk" not in node_map[tgt_id].get("evidence", ""):
                        node_map[tgt_id]["evidence"] += f" | Risk propagated from {node_map[src_id]['name']}"

    return list(node_map.values())

# ----------------------------------------------------------------------
# 4. GraphRAG Extraction Execution Wrapper
# ----------------------------------------------------------------------
def extract_graph_from_file(file_path: Path) -> Dict[str, Any]:
    raw_text = extract_raw_text(file_path)
    if not raw_text.strip():
        raise ValueError(f"No parseable text content found in {file_path.name}")

    # Call Gemini 2.0 Flash for GraphRAG Structure Extraction
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=f"Document Name: {file_path.name}\n\nIngested Document Context:\n{raw_text[:30000]}",
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are an Enterprise GraphRAG Risk Extractor. "
                "Analyze the ingested text and construct a structured Knowledge Graph. "
                "Extract operational entities (Vendors, Products, Components, Shipments, Regulations) and "
                "map directional dependencies ('SUPPLIES', 'DEPENDS_ON', 'DELAYED_BY', 'AFFECTS'). "
                "Carefully evaluate risk_score (0.0 = nominal, 1.0 = critical failure) based on delay, compliance, or shortage evidence."
            ),
            response_mime_type="application/json",
            response_schema=GraphRAGExtraction,
        ),
    )

    extracted_data = json.loads(response.text)
    
    # Position layout formatting for React Flow canvas
    raw_nodes = extracted_data.get("nodes", [])
    raw_edges = extracted_data.get("edges", [])
    
    # Calculate force-directed layout positions
    total = len(raw_nodes)
    center_x, center_y = 450, 300
    radius = 180 + (total * 10)
    
    nodes_formatted = []
    for idx, n in enumerate(raw_nodes):
        angle = (idx / total) * 2 * math.pi if total > 0 else 0
        n_dict = n if isinstance(n, dict) else n.dict()
        n_dict["x"] = center_x + (radius * math.cos(angle))
        n_dict["y"] = center_y + (radius * math.sin(angle))
        n_dict["frequency"] = 1
        nodes_formatted.append(n_dict)

    edges_formatted = [e if isinstance(e, dict) else e.dict() for e in raw_edges]
    
    # Run Risk Propagation Algorithm
    final_nodes = propagate_graph_risks(nodes_formatted, edges_formatted)

    return {
        "nodes": final_nodes,
        "edges": edges_formatted
    }