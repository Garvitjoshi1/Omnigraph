# OmniGraph

OmniGraph is a hackathon-ready autonomous enterprise data orchestrator for dark data. It generates isolated ETL candidates with Gemini, validates them in a restricted subprocess, writes supply-chain entities into Neo4j, and ranks graph nodes by operational risk using a small CPU-friendly GNN.

## Layout

```text
app/                  Streamlit product UI
src/omnigraph/        Backend modules
  agent_core.py       Multi-agent ETL workflow and secure test sandbox
  graph_builder.py    Neo4j ingestion and natural-language graph querying
  analytics.py        Lightweight PyTorch graph-risk model
scripts/              Developer utilities
data/raw/             Generated dark-data inputs (ignored by Git)
tests/                Unit-test home
```

## Quick start

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/mock_data_generator.py
streamlit run app/streamlit_app.py
```

## Customer web platform (recommended)

The React platform is the primary customer-facing experience. Start the API from
the repository root, then start the frontend in a second terminal:

```powershell
$env:PYTHONPATH="$PWD\src"
uvicorn omnigraph.api:app --reload
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API documentation is available at
`http://127.0.0.1:8000/docs`.

The app starts in a fully working, no-cost offline demo mode. Copy `.env.example` to `.env` only when you want to enable the optional Gemini and Neo4j paths.

## Optional Gemini connection

Create an API key in Google AI Studio and add it as `GOOGLE_API_KEY` in `.env`.
The current SDK also accepts `GEMINI_API_KEY`. The cloud ETL path uses the model
in `GEMINI_MODEL`; if your account has no available Gemini quota, leave the key
blank and use the offline demo instead.

## Optional Neo4j connection

Install Neo4j Community, start it, then open `http://localhost:7474`. Sign in as `neo4j`; the first-run screen asks you to choose a password. Put that exact password in `NEO4J_PASSWORD` - `change-me` was only a placeholder, never a real credential. Keep `NEO4J_URI=bolt://localhost:7687` and `NEO4J_USERNAME=neo4j`.

## Security model

Generated ETL code never receives secrets or the full application environment. `agent_core.py` statically rejects dangerous imports/calls, then executes only the candidate script against a temporary copy of one input using an isolated Python interpreter and a short timeout. Container/VM isolation should be added before accepting arbitrary untrusted model output in production.
