"""Security and contract checks that do not require cloud services."""
from pathlib import Path

from omnigraph.agent_core import inspect_generated_code, run_in_sandbox


def test_rejects_network_import() -> None:
    assert "Blocked import" in (inspect_generated_code("import socket") or "")


def test_sandbox_accepts_normalized_output(tmp_path: Path) -> None:
    input_file = tmp_path / "input.json"
    input_file.write_text("{}", encoding="utf-8")
    script = '''import json
from pathlib import Path
def run(input_path, output_path):
    Path(output_path).write_text(json.dumps({"nodes": [], "edges": [], "provenance": {}}))
'''
    assert run_in_sandbox(script, input_file).passed
