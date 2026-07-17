"""HTTP API for the OmniGraph customer web platform."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .offline_demo import DEMO_EDGES, DEMO_NODES, answer_question, source_status

ROOT = Path(__file__).resolve().parents[2]
UPLOAD_DIR = ROOT / "data" / "uploads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".json", ".csv", ".txt", ".sqlite", ".db"}
uploaded_sources: list[dict[str, str]] = []

# CODEX_DECISION: FastAPI offers typed request validation and automatic OpenAPI
# documentation while remaining lightweight enough for the hackathon demo.
app = FastAPI(title="OmniGraph API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class QuestionRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "mode": "offline-demo"}


@app.get("/api/dashboard")
def dashboard() -> dict[str, object]:
    """Return the dashboard's graph, source, and risk state in one request."""
    nodes = [node.__dict__ for node in DEMO_NODES]
    risks = sorted(nodes, key=lambda row: row["risk_score"], reverse=True)
    return {
        "mode": "offline-demo",
        "sources": source_status(ROOT / "data" / "raw") + uploaded_sources,
        "nodes": nodes,
        "edges": [edge.__dict__ for edge in DEMO_EDGES],
        "risks": risks,
        "metrics": {"source_count": 3, "node_count": len(nodes), "high_risk_count": len([node for node in DEMO_NODES if node.risk_score >= 0.8])},
    }


@app.post("/api/query")
def query(request: QuestionRequest) -> dict[str, str]:
    """Answer an analyst question using the zero-cost local graph model."""
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="A question is required.")
    answer, cypher = answer_question(request.question)
    return {"answer": answer, "cypher": cypher, "mode": "offline-demo"}


def _summarize_upload(filename: str, content: bytes) -> str:
    """Return a safe local analysis, without executing or trusting user files."""
    lowered = content.decode("utf-8", errors="ignore").lower()
    signals = [term for term in ("delay", "customs", "hold", "late", "risk", "supplier") if term in lowered]
    if filename.lower().endswith(".pdf"):
        return "PDF accepted and queued for document entity extraction."
    if signals:
        return f"Detected supply-chain signals: {', '.join(signals)}. Ready for graph extraction."
    return "Source accepted and queued for schema and entity extraction."


@app.post("/api/upload")
async def upload_sources(files: list[UploadFile] = File(...)) -> dict[str, object]:
    """Validate and retain customer data files for the ingestion workflow."""
    if len(files) > 5:
        raise HTTPException(status_code=422, detail="Upload at most five files at a time.")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, str]] = []
    for file in files:
        filename = Path(file.filename or "upload").name
        extension = Path(filename).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=415, detail=f"{filename}: supported formats are PDF, JSON, CSV, TXT, SQLite, and DB.")
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"{filename} exceeds the 10 MB upload limit.")
        stored_name = f"{uuid4().hex}{extension}"
        (UPLOAD_DIR / stored_name).write_bytes(content)
        item = {"source": "Customer upload", "file": filename, "status": "Ready", "analysis": _summarize_upload(filename, content)}
        uploaded_sources.append({key: item[key] for key in ("source", "file", "status", "analysis")})
        results.append(item)
    return {"uploads": results, "message": "Files validated and added to the ingestion queue."}
