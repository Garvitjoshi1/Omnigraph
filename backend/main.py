import sys
from pathlib import Path
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from google import genai
from google.genai import types

# Dynamically resolve absolute project root paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(PROJECT_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT / "src"))

from backend.pipeline import extract_graph_from_file
from omnigraph.offline_demo import source_status

app = FastAPI(title="OmniGraph SaaS Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str

DYNAMIC_GRAPH_STORE = {
    "nodes": [],
    "edges": []
}

# Initialize Google GenAI client platform
client = genai.Client()

@app.post("/api/query")
def query_graph(request: QueryRequest):
    global DYNAMIC_GRAPH_STORE
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Query prompt string cannot be null.")
    
    # Safely format current knowledge graph memory
    nodes_context = [
        f"Node(id='{n.get('id', '')}', label='{n.get('label', '')}', name='{n.get('name', '')}', weight={n.get('frequency', 1)}, risk={n.get('risk_score', 0.0)})"
        for n in DYNAMIC_GRAPH_STORE["nodes"]
    ]
    edges_context = [
        f"Edge(source='{e.get('source', '')}', relationship='{e.get('relationship', '')}', target='{e.get('target', '')}')"
        for e in DYNAMIC_GRAPH_STORE["edges"]
    ]
    
    graph_payload_str = (
        "Active Knowledge Graph Memory State:\n"
        "Nodes:\n" + ("\n".join(nodes_context) if nodes_context else "No nodes currently mounted.") + "\n\n"
        "Edges:\n" + ("\n".join(edges_context) if edges_context else "No edges currently mounted.")
    )
    
    try:
        # Prompt Gemini using strict GenerateContentConfig class
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=f"{graph_payload_str}\n\nUser Question: {request.question}",
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are the structural OmniGraph Semantic Engine Copilot. "
                    "Answer the user's operational inquiry based ONLY on the dynamic graph network data provided. "
                    "Provide a clean, precise conceptual answer summary without any emojis. "
                    "If the knowledge graph is currently empty, politely instruct the user to synthesize or upload data first."
                )
            )
        )
        
        # Generate targeted Cypher trace
        cypher_response = "MATCH (n)-[r]->(m) RETURN n, r, m"
        if DYNAMIC_GRAPH_STORE["nodes"]:
            q_lower = request.question.lower()
            for node in DYNAMIC_GRAPH_STORE["nodes"]:
                node_name = str(node.get("name", "")).lower()
                node_id = str(node.get("id", "")).lower()
                if (node_name and node_name in q_lower) or (node_id and node_id in q_lower):
                    cypher_response = f"MATCH (n {{id: '{node.get('id')}'}})-[r]->(m) RETURN n, r, m"
                    break
        
        return {
            "answer": response.text.strip() if response.text else "No analytical output generated.",
            "cypher": cypher_response
        }
    except Exception as e:
        return {
            "answer": f"Analytical Copilot execution exception: {str(e)}",
            "cypher": "MATCH (n)-[r]->(m) RETURN n, r, m"
        }

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    global DYNAMIC_GRAPH_STORE
    raw_dir = PROJECT_ROOT / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    
    uploads_manifest = []
    
    for file in files:
        file_path = raw_dir / file.filename
        content = await file.read()
        
        with open(file_path, "wb") as f:
            f.write(content)
            
        try:
            extracted_obsidian_slice = extract_graph_from_file(file_path)
            
            for node in extracted_obsidian_slice["nodes"]:
                if not any(existing["id"] == node["id"] for existing in DYNAMIC_GRAPH_STORE["nodes"]):
                    DYNAMIC_GRAPH_STORE["nodes"].append(node)
                    
            for edge in extracted_obsidian_slice["edges"]:
                if not any(e["source"] == edge["source"] and e["target"] == edge["target"] for e in DYNAMIC_GRAPH_STORE["edges"]):
                    DYNAMIC_GRAPH_STORE["edges"].append(edge)
            
            uploads_manifest.append({
                "file": file.filename,
                "status": "Ready",
                "analysis": f"AI Engine cleanly structured {len(extracted_obsidian_slice['nodes'])} genuine semantic concepts."
            })
        except Exception as e:
            uploads_manifest.append({
                "file": file.filename,
                "status": "Failed",
                "analysis": f"Parsing exception logic error: {str(e)}"
            })

    return {
        "message": "Ingestion routing complete.",
        "uploads": uploads_manifest
    }

@app.get("/api/dashboard")
def get_dashboard_data():
    raw_dir = PROJECT_ROOT / "data" / "raw"
    sources = source_status(raw_dir)
    
    current_nodes = DYNAMIC_GRAPH_STORE["nodes"]
    if not current_nodes:
        current_nodes = [{
            "id": "init:root", 
            "label": "System", 
            "name": "Awaiting Payload Ingestion", 
            "risk_score": 0.0, 
            "frequency": 1,
            "evidence": "Platform core operational.", 
            "x": 400, 
            "y": 300
        }]
    
    calculated_risks = [
        {
            "id": n.get("id", ""),
            "name": n.get("name", ""),
            "risk_score": n.get("risk_score", 0.0),
            "evidence": n.get("evidence", "")
        }
        for n in sorted(current_nodes, key=lambda x: x.get("risk_score", 0.0), reverse=True)
    ]
    
    return {
        "sources": sources,
        "risks": calculated_risks,
        "nodes": current_nodes,
        "edges": DYNAMIC_GRAPH_STORE["edges"]
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)