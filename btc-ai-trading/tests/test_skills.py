"""Skills follow the Agent Skills / Claude Code SKILL.md format and stay in sync."""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = ["market-analysis", "technical-analysis", "smart-money-concepts", "liquidity-analysis", "market-regime",
            "adaptive-strategy", "scalping", "intraday", "trend-following", "risk-management",
            "hyperliquid-execution", "backtesting", "machine-learning", "performance-analysis"]
ALLOWED_KEYS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
SECTIONS = ["Description", "Objectif", "Compétences", "Méthodes", "Règles de décision", "Conditions de validation",
            "Conditions de refus", "Exemples structurés"]


def frontmatter(text: str) -> dict:
    assert text.startswith("---\n"), "frontmatter must start on the first line"
    block = text.split("---\n", 2)[1]
    keys = {}
    for line in block.splitlines():
        m = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if m:
            keys[m.group(1)] = m.group(2)
    return keys


@pytest.mark.parametrize("name", REQUIRED + ["range-trading"])
def test_skill_format(name):
    p = ROOT / "skills" / name / "SKILL.md"
    assert p.exists(), f"missing skill {name}"
    text = p.read_text(encoding="utf-8")
    fm = frontmatter(text)
    assert set(fm) <= ALLOWED_KEYS, f"non-standard keys {set(fm) - ALLOWED_KEYS}"
    assert fm["name"] == name and re.fullmatch(r"[a-z0-9-]{1,64}", fm["name"])
    assert 20 < len(fm["description"]) <= 1024
    for s in SECTIONS:
        assert s in text, f"{name}: section '{s}' missing"


def test_claude_code_copies_in_sync():
    for src in (ROOT / "skills").glob("*/SKILL.md"):
        dst = ROOT / ".claude" / "skills" / src.parent.name / "SKILL.md"
        assert dst.exists() and dst.read_bytes() == src.read_bytes(), \
            f"run python scripts/sync_claude_skills.py ({src.parent.name} out of sync)"
