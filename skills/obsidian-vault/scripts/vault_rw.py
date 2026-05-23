#!/usr/bin/env python3
"""Reliable read/write for iCloud-synced Obsidian vault with deadlock handling."""

import argparse
import os
import pathlib
import shutil
import sys
import tempfile
import time
from typing import Optional

VAULT_DEFAULT = pathlib.Path(
    os.path.expanduser("~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Jensen2")
)


def _vault_path(rel_path: str, vault: pathlib.Path) -> pathlib.Path:
    """Resolve relative path inside vault, preventing directory traversal."""
    target = (vault / rel_path).resolve()
    if not str(target).startswith(str(vault.resolve())):
        raise ValueError(f"Path escapes vault: {rel_path}")
    return target


def _read_with_retry(path: pathlib.Path, max_attempts: int = 3, delay: float = 2.0) -> str:
    """Read file, handling iCloud 'Resource deadlock avoided'."""
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            return path.read_text(encoding="utf-8")
        except OSError as e:
            last_err = e
            if "deadlock" in str(e).lower() or attempt < max_attempts:
                time.sleep(delay)
                continue
            raise
    raise last_err


def _write_with_retry(path: pathlib.Path, content: str, max_attempts: int = 3, delay: float = 2.0) -> None:
    """Write file, handling iCloud 'Resource deadlock avoided'."""
    path.parent.mkdir(parents=True, exist_ok=True)
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            path.write_text(content, encoding="utf-8")
            return
        except OSError as e:
            last_err = e
            if "deadlock" in str(e).lower() or attempt < max_attempts:
                # Try writing via /tmp copy
                try:
                    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as f:
                        f.write(content)
                        tmp_path = pathlib.Path(f.name)
                    shutil.copy(str(tmp_path), str(path))
                    tmp_path.unlink()
                    return
                except Exception:
                    time.sleep(delay)
                    continue
            raise
    raise last_err


def _parse_frontmatter(text: str) -> tuple[Optional[str], str]:
    """Split text into frontmatter (if present) and body."""
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            return parts[1].strip(), parts[2].strip()
    return None, text.strip()


def _update_frontmatter_date(text: str, new_date: str) -> str:
    """Update date_updated in frontmatter."""
    fm, body = _parse_frontmatter(text)
    if fm is None:
        # No frontmatter — add one
        return "---\ndate_updated: " + new_date + "\n---\n\n" + text
    
    lines = fm.splitlines()
    updated = False
    new_lines = []
    for line in lines:
        if line.strip().startswith("date_updated:"):
            new_lines.append("date_updated: " + new_date)
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append("date_updated: " + new_date)
    
    return "---\n" + "\n".join(new_lines) + "\n---\n\n" + body


def cmd_read(args) -> int:
    vault = pathlib.Path(args.vault)
    target = _vault_path(args.path, vault)
    try:
        content = _read_with_retry(target)
        print(content)
        return 0
    except Exception as e:
        print(f"Error reading {target}: {e}", file=sys.stderr)
        return 1


def cmd_write(args) -> int:
    vault = pathlib.Path(args.vault)
    target = _vault_path(args.path, vault)
    content = args.content
    if content is None:
        content = sys.stdin.read()
    try:
        _write_with_retry(target, content)
        print(f"Written: {target}")
        return 0
    except Exception as e:
        print(f"Error writing {target}: {e}", file=sys.stderr)
        return 1


def cmd_update_frontmatter(args) -> int:
    vault = pathlib.Path(args.vault)
    target = _vault_path(args.path, vault)
    try:
        text = _read_with_retry(target)
        updated = _update_frontmatter_date(text, args.date_updated)
        _write_with_retry(target, updated)
        print(f"Updated frontmatter: {target}")
        return 0
    except Exception as e:
        print(f"Error updating {target}: {e}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Obsidian vault read/write helper")
    parser.add_argument("--vault", default=str(VAULT_DEFAULT), help="Vault path")
    sub = parser.add_subparsers(dest="cmd", required=True)

    read_p = sub.add_parser("read", help="Read a file")
    read_p.add_argument("path", help="Relative path inside vault")

    write_p = sub.add_parser("write", help="Write a file")
    write_p.add_argument("path", help="Relative path inside vault")
    write_p.add_argument("--content", help="File content (or read from stdin)")

    fm_p = sub.add_parser("update-frontmatter", help="Update date_updated in frontmatter")
    fm_p.add_argument("path", help="Relative path inside vault")
    fm_p.add_argument("--date-updated", required=True, help="New date_updated value (YYYY-MM-DD)")

    args = parser.parse_args()

    if args.cmd == "read":
        return cmd_read(args)
    elif args.cmd == "write":
        return cmd_write(args)
    elif args.cmd == "update-frontmatter":
        return cmd_update_frontmatter(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
