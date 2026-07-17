"""Safe translation between normalized entities, Neo4j, and analyst questions."""
from __future__ import annotations

import json
import re
from typing import Any

from neo4j import GraphDatabase

from .agent_core import ExtractionResult
from .config import settings

# CODEX_DECISION: Whitelisting labels and relationship types avoids Cypher
# identifier injection, since parameters cannot safely replace identifiers.
ALLOWED_LABELS = {"Supplier", "Product", "Shipment", "Facility", "Contract", "RiskEvent", "Person"}
ALLOWED_RELATIONSHIPS = {"SUPPLIES", "SHIPS", "DELIVERED_TO", "AFFECTS", "GOVERNED_BY", "ESCALATED_TO", "DEPENDS_ON"}
WRITE_FORBIDDEN = re.compile(r"\b(CREATE|MERGE|DELETE|SET|REMOVE|DROP|CALL|LOAD|FOREACH)\b", re.IGNORECASE)


class GraphBuilder:
    """Neo4j repository with parameterized writes and read-only NL querying."""

    def __init__(self) -> None:
        if not settings.neo4j_password:
            raise RuntimeError("NEO4J_PASSWORD is required to connect to Neo4j.")
        self.driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_username, settings.neo4j_password))

    def close(self) -> None:
        self.driver.close()

    @staticmethod
    def _label(value: str) -> str:
        if value not in ALLOWED_LABELS:
            raise ValueError(f"Unsupported node label: {value}")
        return value

    @staticmethod
    def _relationship(value: str) -> str:
        if value not in ALLOWED_RELATIONSHIPS:
            raise ValueError(f"Unsupported relationship: {value}")
        return value

    def populate_graph(self, extraction: ExtractionResult) -> None:
        """Upsert nodes and edges using stable ETL entity IDs."""
        with self.driver.session() as session:
            for node in extraction.nodes:
                label = self._label(node.label)
                session.run(f"MERGE (n:{label} {{id: $id}}) SET n += $properties", id=node.id, properties=node.properties)
            for edge in extraction.edges:
                relationship = self._relationship(edge.relationship)
                session.run(
                    f"MATCH (a {{id: $source_id}}), (b {{id: $target_id}}) MERGE (a)-[r:{relationship}]->(b) SET r += $properties",
                    source_id=edge.source_id, target_id=edge.target_id, properties=edge.properties,
                )

    def query_graph(self, question: str, model: str = settings.gemini_model) -> list[dict[str, Any]]:
        """Translate a plain-English question to bounded, read-only Cypher and run it."""
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY or GEMINI_API_KEY is required for live natural-language queries.")
        from google import genai
        client = genai.Client(api_key=settings.google_api_key)
        response = client.models.generate_content(
            model=model,
            contents=("Return only JSON: {cypher: string, params: object}. Generate read-only Cypher using MATCH/OPTIONAL MATCH, WHERE, WITH, RETURN, ORDER BY, LIMIT only. Always include LIMIT <= 50. Use $params for values. Schema labels: " + ", ".join(sorted(ALLOWED_LABELS)) + "; relationships: " + ", ".join(sorted(ALLOWED_RELATIONSHIPS)) + "\n\nQuestion: " + question),
        )
        if not response.text:
            raise RuntimeError("Gemini returned no Cypher query.")
        payload = json.loads(response.text[response.text.find("{") : response.text.rfind("}") + 1])
        cypher = payload["cypher"].strip()
        if WRITE_FORBIDDEN.search(cypher) or not cypher.upper().startswith(("MATCH", "OPTIONAL MATCH")):
            raise ValueError("Generated query was not read-only Cypher.")
        with self.driver.session() as session:
            return [record.data() for record in session.run(cypher, payload.get("params", {}))]
