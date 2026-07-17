"""Small, demonstrable product surface for the OmniGraph pipeline."""
from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from omnigraph.offline_demo import DEMO_NODES, answer_question, graphviz_dot, source_status

st.set_page_config(page_title="OmniGraph", page_icon="◈", layout="wide")
st.title("◈ OmniGraph")
st.caption("Autonomous dark-data orchestration for supply-chain decisions")

raw_dir = ROOT / "data" / "raw"
left, right, third = st.columns(3)
left.metric("Dark-data sources", len([row for row in source_status(raw_dir) if row["status"] == "Ready"]))
right.metric("Graph engine", "Local demo graph")
third.metric("Highest risk", "NS-884 - 96%")

st.subheader("Pipeline workspace")
st.success("Offline demo mode is active - no OpenAI credits or Neo4j server are required.")
with st.expander("Ingestion status", expanded=True):
    st.dataframe(source_status(raw_dir), hide_index=True, use_container_width=True)
left_panel, right_panel = st.columns((3, 2))
with left_panel:
    st.subheader("Supply-chain dependency graph")
    st.graphviz_chart(graphviz_dot(), use_container_width=True)
with right_panel:
    st.subheader("Predicted failure risk")
    st.dataframe([{"Node": node.name, "Risk": f"{node.risk_score:.0%}", "Evidence": node.evidence} for node in sorted(DEMO_NODES, key=lambda item: item.risk_score, reverse=True)], hide_index=True, use_container_width=True)
st.subheader("Ask the knowledge graph")
question = st.text_input("Question", placeholder="How does the delay at NorthStar affect Product B?")
if question:
    answer, cypher = answer_question(question)
    st.write(answer)
    with st.expander("Equivalent Cypher query"):
        st.code(cypher, language="cypher")
