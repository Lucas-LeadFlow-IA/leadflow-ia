"""Copy skills/<name>/SKILL.md into .claude/skills/<name>/SKILL.md.

Claude Code discovers project skills in `.claude/skills/<name>/SKILL.md`
(nested directories are loaded when Claude works in this sub-project).
Plain copies are used instead of symlinks so the repository also works on
Windows checkouts. `tests/test_skills.py` fails if the copies drift.

  python scripts/sync_claude_skills.py
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "skills"
DST = ROOT / ".claude" / "skills"


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in SRC.iterdir() if (p / "SKILL.md").exists())
    for name in names:
        (DST / name).mkdir(exist_ok=True)
        shutil.copyfile(SRC / name / "SKILL.md", DST / name / "SKILL.md")
    for stale in DST.iterdir():
        if stale.is_dir() and stale.name not in names:
            shutil.rmtree(stale)
    print(f"synced {len(names)} skills -> {DST}")


if __name__ == "__main__":
    main()
