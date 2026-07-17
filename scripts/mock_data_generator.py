"""Generate deliberately messy dark-data fixtures for OmniGraph ETL demos.

This script is deterministic: rerunning it replaces the three source datasets,
making demos and tests reproducible.
"""
from __future__ import annotations

import json
import random
import sqlite3
from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
RANDOM_SEED = 20260716


def write_logistics_database(destination: Path) -> None:
    """Create a SQLite operational dump with inconsistent supply-chain fields."""
    connection = sqlite3.connect(destination)
    connection.execute("DROP TABLE IF EXISTS dispatch_events")
    connection.execute("""CREATE TABLE dispatch_events (event_ref TEXT, supplier_name TEXT, sku TEXT, event_time TEXT, status_note TEXT, eta TEXT, units TEXT, facility TEXT)""")
    rows = [
        ("EVT-001", "NorthStar Components Ltd.", "PUMP-AX9", "2026/07/10 08:15", "Loaded / no issues", "2026-07-13", "1,200", "Pune DC"),
        ("evt 002", "northstar comp.", "pump ax-9", "Jul 11 2026 14:40 IST", "HOLD - customs paperwork???", "TBD", "1200 units", "Nhava Sheva"),
        ("003", "Acme Steel", "FRAME-4", "11-07-26", "arrived 6hrs late; line at risk", "07/12/2026", "400", "Chennai/Plant-2"),
        ("EVT-004", "ACME STEEL INC", "frame_04", "2026-07-12T17:05:00Z", "released", "2026-07-14", "four hundred", "Chennai Plant 2"),
        ("E-005", "NorthStar Components", "PUMP-AX9", "2026-07-13 06:00", "container #NS-884 delay 2 days", "2026-07-15??", "1.2k", "Pune Distribution Center"),
    ]
    connection.executemany("INSERT INTO dispatch_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
    connection.commit()
    connection.close()


def write_contract_pdf(destination: Path) -> None:
    """Create a visually readable, but intentionally free-form supplier contract."""
    # CODEX_DECISION: ReportLab provides portable, deterministic PDF generation.
    doc = SimpleDocTemplate(str(destination), pagesize=LETTER, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("NORTHSTAR COMPONENTS LTD. - SUPPLY AGREEMENT", styles["Title"]), Spacer(1, 12),
        Paragraph("Agreement ref: NSC/26-Q3 | Effective: 01 July 2026", styles["Heading2"]),
        Paragraph("Supplier: NorthStar Components Ltd. (also trading as NorthStar Comp.)", styles["BodyText"]),
        Paragraph("Buyer: Omni Manufacturing India, Pune Distribution Center.", styles["BodyText"]), Spacer(1, 10),
        Paragraph("1. Deliverables", styles["Heading2"]),
        Paragraph("Supplier will furnish PUMP-AX9 hydraulic pumps: 1,200 units per weekly shipment. Target lead time is 72 hours from release at Nhava Sheva port to Pune DC.", styles["BodyText"]), Spacer(1, 8),
        Paragraph("2. Service and exceptions", styles["Heading2"]),
        Paragraph("A delivery becomes CRITICAL when it is more than 24 hrs late or when customs documentation remains unresolved. Repeated delay permits buyer escalation to the assembly line owner for Product B (HydraLift B).", styles["BodyText"]), Spacer(1, 8),
        Paragraph("Contact: Asha Rao, logistics escalation lead; asha.rao@northstar.example", styles["BodyText"]),
    ]
    doc.build(story)


def write_internal_communications(destination: Path) -> None:
    """Create a Slack-like JSON export with abbreviations, typos, and duplicates."""
    messages = [
        {"ts": "1720677900.0001", "channel": "#supply-war-room", "user": "mia", "text": "NorthStar's NS-884 is stuck @ customs again. Pump AX9 might miss PUNE by ~48h."},
        {"ts": "1720681500.0002", "channel": "#assembly", "user": "ravi", "text": "FYI HydraLift B (Product B) consumes PUMP-AX9. We have 0.8 days buffer."},
        {"ts": "1720690000.0003", "channel": "#supply-war-room", "user": "asha", "text": "Docs corrected, but ETA is now 15 Jul?? escalated under NSC/26-Q3."},
        {"ts": "1720693600.0004", "channel": "#ops", "user": "system", "text": "ACME steel frame_04 received late - Plant2 production sched affected."},
        {"ts": "1720693610.0005", "channel": "#ops", "user": "system", "text": "ACME steel frame_04 received late - Plant2 production sched affected."},
    ]
    random.shuffle(messages)
    destination.write_text(json.dumps({"workspace": "omni-manufacturing", "messages": messages}, indent=2), encoding="utf-8")


def main() -> None:
    random.seed(RANDOM_SEED)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    write_logistics_database(RAW_DIR / "logistics_operations_dump.sqlite")
    write_contract_pdf(RAW_DIR / "northstar_supplier_contract.pdf")
    write_internal_communications(RAW_DIR / "internal_slack_export.json")
    print(f"Created 3 dark-data fixtures in {RAW_DIR}")


if __name__ == "__main__":
    main()
