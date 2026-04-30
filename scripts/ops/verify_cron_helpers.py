#!/usr/bin/env python3
"""Verify local helper scripts referenced by OpenClaw cron jobs exist."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
HOME = Path.home()

REQUIRED_PATHS = [
    REPO_ROOT / "scripts/ops/discord_health_report.py",
    REPO_ROOT / "ops/discord_health_report.py",
    HOME / "clawd/scripts/sessions_activity_summary.py",
    HOME / "bin/sessions_activity_summary",
]


def main() -> int:
    missing = [str(path) for path in REQUIRED_PATHS if not path.exists()]
    non_executable = [
        str(path)
        for path in REQUIRED_PATHS
        if path.exists() and path.suffix in {"", ".py"} and not path.stat().st_mode & 0o111
    ]
    result = {
        "ok": not missing and not non_executable,
        "checked": [str(path) for path in REQUIRED_PATHS],
        "missing": missing,
        "nonExecutable": non_executable,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
