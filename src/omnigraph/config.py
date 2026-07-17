"""Central, typed configuration so infrastructure concerns stay out of services."""
from __future__ import annotations

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
except ImportError:  # Allows offline sandbox checks before dependency install.
    load_dotenv = lambda: False

load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Runtime settings loaded only from explicit environment variables."""

    # CODEX_DECISION: Keep the Gemini model configurable so deployments can
    # switch models without changing reviewed orchestration code.
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    google_api_key: str | None = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_username: str = os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_password: str | None = os.getenv("NEO4J_PASSWORD")


settings = Settings()
