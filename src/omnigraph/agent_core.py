"""Autonomous, reviewable ETL generation for unstructured OmniGraph inputs.

The workflow uses separate planning, coding, and validation roles. Generated code
is *never* given application credentials and must pass a static policy plus an
isolated smoke test before a caller can promote it to the main pipeline.
"""
from __future__ import annotations

import ast
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from .config import settings


class GraphNode(BaseModel):
    """Normalized entity contract shared by ETL, graph, and analytics layers."""

    id: str
    label: str
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source_id: str
    target_id: str
    relationship: str
    properties: dict[str, Any] = Field(default_factory=dict)


class ExtractionResult(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    provenance: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class SandboxResult:
    passed: bool
    stdout: str
    stderr: str
    reason: str = ""


# CODEX_DECISION: AST inspection is used before subprocess execution because it
# is deterministic, auditable, and catches common unsafe code-generation paths.
BLOCKED_IMPORTS = {"os", "subprocess", "socket", "requests", "httpx", "urllib", "shutil", "ctypes", "multiprocessing"}
BLOCKED_CALLS = {"eval", "exec", "compile", "open", "input", "__import__", "breakpoint"}


def _extract_json_object(text: str) -> dict[str, Any]:
    """Accept model JSON even if it was accidentally wrapped in Markdown."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Model response did not contain a JSON object.")
    return json.loads(text[start : end + 1])


def inspect_generated_code(source: str) -> str | None:
    """Return a policy violation, or None when the small ETL subset is allowed."""
    try:
        tree = ast.parse(source)
    except SyntaxError as error:
        return f"Syntax error: {error.msg}"
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [alias.name.split(".")[0] for alias in node.names]
            if any(name in BLOCKED_IMPORTS for name in names):
                return f"Blocked import: {', '.join(names)}"
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in BLOCKED_CALLS:
            return f"Blocked call: {node.func.id}"
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            return "Dunder attribute access is not allowed."
    return None


def run_in_sandbox(script_source: str, input_file: Path, timeout_seconds: int = 12) -> SandboxResult:
    """Smoke-test a generated ETL script against a disposable input copy.

    Candidate scripts must expose ``run(input_path, output_path)`` and produce a
    JSON object matching ``ExtractionResult``. This is process isolation, not a
    complete security boundary; production should run it in a locked-down VM.
    """
    violation = inspect_generated_code(script_source)
    if violation:
        return SandboxResult(False, "", "", violation)
    with tempfile.TemporaryDirectory(prefix="omnigraph-etl-") as temp_dir:
        root = Path(temp_dir)
        sandbox_input = root / input_file.name
        shutil.copy2(input_file, sandbox_input)
        script_path, output_path = root / "candidate.py", root / "result.json"
        wrapper = "\n".join([
            script_source,
            "\nif __name__ == '__main__':",
            f"    run({str(sandbox_input)!r}, {str(output_path)!r})",
        ])
        script_path.write_text(wrapper, encoding="utf-8")
        try:
            # CODEX_DECISION: -I ignores user site packages and environment
            # variables, reducing accidental access to developer credentials.
            completed = subprocess.run(
                [sys.executable, "-I", str(script_path)], cwd=root, text=True,
                capture_output=True, timeout=timeout_seconds, check=False,
            )
        except subprocess.TimeoutExpired:
            return SandboxResult(False, "", "", "Candidate timed out.")
        if completed.returncode != 0:
            return SandboxResult(False, completed.stdout, completed.stderr, "Candidate exited unsuccessfully.")
        try:
            ExtractionResult.model_validate_json(output_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            return SandboxResult(False, completed.stdout, completed.stderr, f"Invalid extraction output: {error}")
        return SandboxResult(True, completed.stdout, completed.stderr)


class ETLAgentWorkflow:
    """Three-role Gemini workflow that plans, generates, and tests ETL code."""

    def __init__(self, model: str = settings.gemini_model) -> None:
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY or GEMINI_API_KEY is required for live ETL generation.")
        # Import only for the live path so local schema/sandbox checks remain
        # available even before optional cloud dependencies are installed.
        from google import genai
        self.client = genai.Client(api_key=settings.google_api_key)
        self.model = model

    def _ask(self, instructions: str, payload: dict[str, Any]) -> str:
        # CODEX_DECISION: One composed prompt keeps the Gemini SDK call simple
        # and makes every agent interaction straightforward to log and audit.
        response = self.client.models.generate_content(
            model=self.model,
            contents=f"{instructions}\n\nTask payload:\n{json.dumps(payload)}",
        )
        if not response.text:
            raise RuntimeError("Gemini returned no text for the ETL task.")
        return response.text

    def plan_extraction(self, source_path: Path, source_preview: str) -> dict[str, Any]:
        """Agent 1 identifies entities and relationships without producing code."""
        return _extract_json_object(self._ask(
            "You are an ETL planner. Return only JSON with keys entities, relationships, parsing_strategy. Infer a compact supply-chain graph from the source preview.",
            {"filename": source_path.name, "preview": source_preview[:12000]},
        ))

    def generate_script(self, source_path: Path, plan: dict[str, Any]) -> str:
        """Agent 2 writes a dependency-free candidate implementing the run contract."""
        prompt = self._ask(
            "You are a secure Python ETL author. Return ONLY Python source. Implement run(input_path, output_path). Use only json, sqlite3, re, pathlib, csv, and standard string operations. Output JSON shaped as {nodes:[{id,label,properties}],edges:[{source_id,target_id,relationship,properties}],provenance:{}}. Never use open(), network, subprocess, eval, or imports outside that allowlist.",
            {"filename": source_path.name, "plan": plan},
        )
        return prompt.removeprefix("```python").removeprefix("```").removesuffix("```").strip()

    def create_verified_script(self, source_path: Path, source_preview: str) -> tuple[str, SandboxResult]:
        """Run planning, code generation, then isolated validation as one workflow."""
        plan = self.plan_extraction(source_path, source_preview)
        script = self.generate_script(source_path, plan)
        return script, run_in_sandbox(script, source_path)
