# OmniGraph

OmniGraph is your next-generation dark-data engine: a polished, autonomous data orchestrator built to mine hidden value from legacy sources, turn it into actionable supply-chain insight, and score risk in real time.

This repo is a complete product prototype with:
- AI-powered ETL candidate generation
- secure sandbox validation for generated code
- graph-native Neo4j ingestion
- operational risk ranking through a compact GNN

## Why it matters

OmniGraph isn't just another data pipeline. It is a living platform that:
- turns messy, unstructured inputs into structured graph entities
- isolates untrusted ETL logic safely before it ever touches production data
- makes supply-chain risk visible through a ranked knowledge graph
- runs fully offline with a demo mode, so you can build without cloud lock-in

## Project layout

```text
app/                  Streamlit product experience
src/omnigraph/        core backend engine
  agent_core.py       autonomous ETL workflow + safe test sandbox
  graph_builder.py    Neo4j graph ingestion + natural-language graph query layer
  analytics.py        lightweight PyTorch risk model for graph nodes
scripts/              build and test helpers
data/raw/             synthetic dark-data inputs for demos
tests/                automated unit tests
```

## Quick start

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/mock_data_generator.py
streamlit run app/streamlit_app.py
```

Open the Streamlit app and explore the full offline demo experience instantly.

## Recommended platform setup

For the full customer-facing stack, run the API and frontend together.

In one terminal:
```powershell
$env:PYTHONPATH="$PWD\src"
uvicorn omnigraph.api:app --reload
```

In another terminal:
```powershell
cd frontend
npm install
npm run dev
```

Then visit `http://localhost:5173`.

API docs are available at `http://127.0.0.1:8000/docs`.

## Gemini & Neo4j (optional)

Want cloud AI or graph persistence? Enable these only when you're ready.

- `GOOGLE_API_KEY` or `GEMINI_API_KEY` powers Gemini-based ETL generation.
- `GEMINI_MODEL` selects the cloud model.
- `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` connect the graph database.

## Security-first design

OmniGraph is built with a safe execution mindset:
- generated ETL code never receives secrets or the full app environment
- `agent_core.py` blocks unsafe imports and dangerous runtime calls
- candidate scripts are executed only in an isolated subprocess against a temporary sample input
- a short timeout prevents runaway execution

> This is a prototype security model. For production, add container or VM isolation before running arbitrary generated code.
