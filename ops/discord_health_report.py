#!/usr/bin/env python3
"""Generate and optionally send an OpenClaw Discord health report.

This script is intentionally dependency-free so it can run from launchd/cron even
when the repo environment is not activated.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

OPENCLAW = os.environ.get("OPENCLAW_BIN", "openclaw")
DEFAULT_CONFIG = Path.home() / ".openclaw" / "openclaw.json"
DEFAULT_LOG = Path.home() / ".openclaw" / "logs" / "gateway.log"
DEFAULT_ERR_LOG = Path.home() / ".openclaw" / "logs" / "gateway.err.log"

SECRET_PATTERN = re.compile(
    r"(mfa\.[A-Za-z0-9_-]+|[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27,}|fw_[A-Za-z0-9]+|AIza[\w-]+|sk-[A-Za-z0-9_-]+)",
)


@dataclass
class CmdResult:
    code: int
    stdout: str
    stderr: str
    timed_out: bool = False


def redact(text: str | bytes) -> str:
    if isinstance(text, bytes):
        text = text.decode(errors="replace")
    return SECRET_PATTERN.sub("[REDACTED]", text)


def run(cmd: list[str], timeout: int = 12) -> CmdResult:
    try:
        proc = subprocess.run(
            cmd,
            text=True,
            capture_output=True,
            timeout=timeout,
            env=os.environ.copy(),
            check=False,
        )
        return CmdResult(proc.returncode, redact(proc.stdout), redact(proc.stderr))
    except subprocess.TimeoutExpired as exc:
        return CmdResult(
            124,
            redact(exc.stdout or ""),
            redact(exc.stderr or ""),
            timed_out=True,
        )
    except FileNotFoundError as exc:
        return CmdResult(127, "", str(exc))


def load_config(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def nested(mapping: dict, *keys: str, default=None):
    cur = mapping
    for key in keys:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def discord_policy_summary(config: dict) -> list[str]:
    discord = nested(config, "channels", "discord", default={}) or {}
    accounts = discord.get("accounts") if isinstance(discord.get("accounts"), dict) else {}
    guilds = discord.get("guilds") if isinstance(discord.get("guilds"), dict) else {}

    channels: list[tuple[str, str, dict]] = []
    for guild_id, guild in guilds.items():
        if not isinstance(guild, dict):
            continue
        guild_channels = guild.get("channels") if isinstance(guild.get("channels"), dict) else {}
        for channel_id, entry in guild_channels.items():
            if isinstance(entry, dict):
                channels.append((str(guild_id), str(channel_id), entry))

    by_account: dict[str, int] = {}
    unmentioned_by_account: dict[str, int] = {}
    disabled = 0
    for _, _, entry in channels:
        if entry.get("enabled") is False:
            disabled += 1
        entry_accounts = entry.get("accounts") if isinstance(entry.get("accounts"), list) else []
        for account in entry_accounts:
            account_id = str(account)
            by_account[account_id] = by_account.get(account_id, 0) + 1
            if entry.get("requireMention") is False:
                unmentioned_by_account[account_id] = unmentioned_by_account.get(account_id, 0) + 1

    open_accounts = sorted(
        account_id
        for account_id, account in accounts.items()
        if isinstance(account, dict) and account.get("groupPolicy") == "open"
    )
    account_bits = ", ".join(f"{k}:{v}" for k, v in sorted(by_account.items())) or "none"
    unmentioned_bits = ", ".join(
        f"{k}:{v}" for k, v in sorted(unmentioned_by_account.items())
    ) or "none"

    return [
        f"Discord root groupPolicy: {discord.get('groupPolicy', 'unset')}",
        f"Discord account groupPolicy=open: {', '.join(open_accounts) if open_accounts else 'none'}",
        f"Configured guild channels: {len(channels)} total, {disabled} disabled",
        f"Assigned channels by account: {account_bits}",
        f"Channels with requireMention=false by account: {unmentioned_bits}",
    ]


def channel_policy_summary(config: dict) -> list[str]:
    telegram = nested(config, "channels", "telegram", default={}) or {}
    whatsapp_laylah = nested(config, "channels", "whatsapp", "accounts", "laylah", default={}) or {}
    telegram_groups = telegram.get("groups") if isinstance(telegram.get("groups"), dict) else {}
    whatsapp_groups = (
        whatsapp_laylah.get("groups") if isinstance(whatsapp_laylah.get("groups"), dict) else {}
    )
    return [
        f"Telegram groupPolicy: {telegram.get('groupPolicy', 'unset')}; wildcard requireMention={telegram_groups.get('*', {}).get('requireMention', 'unset') if isinstance(telegram_groups.get('*'), dict) else 'unset'}",
        f"WhatsApp laylah groupPolicy: {whatsapp_laylah.get('groupPolicy', 'unset')}; wildcard requireMention={whatsapp_groups.get('*', {}).get('requireMention', 'unset') if isinstance(whatsapp_groups.get('*'), dict) else 'unset'}",
    ]


def tail_lines(path: Path, limit: int) -> list[str]:
    try:
        lines = path.read_text(errors="replace").splitlines()
    except FileNotFoundError:
        return []
    return [redact(line) for line in lines[-limit:]]


def count_recent_patterns(lines: Iterable[str]) -> dict[str, int]:
    patterns = {
        "discord_ws_1006": "Gateway websocket closed: 1006",
        "discord_heartbeat_timeout": "Gateway heartbeat ACK timeout",
        "discord_handshake_timeout": "Opening handshake has timed out",
        "discord_rate_limited": "You are being rate limited",
        "agent_auth_401": "401 status code",
        "agent_timeout": "timed out",
        "event_loop_lag": "liveness warning",
    }
    counts = {key: 0 for key in patterns}
    for line in lines:
        for key, needle in patterns.items():
            if needle in line:
                counts[key] += 1
    return counts


def format_probe(name: str, result: CmdResult, max_lines: int = 8) -> list[str]:
    status = "timeout" if result.timed_out else ("ok" if result.code == 0 else f"exit {result.code}")
    lines = [f"{name}: {status}"]
    output = (result.stdout or result.stderr).strip().splitlines()
    for line in output[:max_lines]:
        clean = line.strip()
        if clean:
            lines.append(f"  {clean[:180]}")
    return lines


def should_run_channels_probe(args: argparse.Namespace) -> bool:
    return bool(args.channels_probe) and not bool(args.skip_channels_probe)


def build_report(args: argparse.Namespace) -> tuple[str, dict[str, int], CmdResult, CmdResult | None]:
    config = load_config(Path(args.config))
    gateway_probe = run([OPENCLAW, "gateway", "probe"], timeout=args.timeout)
    channels_status = None
    if should_run_channels_probe(args):
        channels_status = run([OPENCLAW, "channels", "status", "--probe"], timeout=args.timeout)
    elif not args.skip_channels_status:
        channels_status = run([OPENCLAW, "channels", "status"], timeout=args.timeout)

    log_lines = tail_lines(Path(args.log), args.log_lines)
    err_lines = tail_lines(Path(args.err_log), args.log_lines)
    counts = count_recent_patterns([*log_lines, *err_lines])

    now = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    title = {
        "gateway": "OpenClaw gateway health report",
        "bots": "OpenClaw Discord bot health report",
        "heal": "OpenClaw Discord self-heal report",
    }.get(args.mode, "OpenClaw Discord health report")
    report: list[str] = [f"{title} — {now}", ""]
    report.extend(format_probe("Gateway probe", gateway_probe))
    if channels_status is not None:
        report.append("")
        label = "Channels probe" if should_run_channels_probe(args) else "Channels snapshot"
        report.extend(format_probe(label, channels_status, max_lines=14))
    else:
        report.append("")
        report.append("Channels probe: skipped")
        report.append("  Deep channel audits are opt-in; pass --channels-probe to run them.")
    report.append("")
    report.append("Policy summary:")
    report.extend(f"- {line}" for line in discord_policy_summary(config))
    report.extend(f"- {line}" for line in channel_policy_summary(config))
    report.append("")
    report.append(f"Recent log scan: last {args.log_lines} lines from gateway.log + gateway.err.log")
    for key, value in counts.items():
        report.append(f"- {key}: {value}")

    if args.include_log_tail:
        report.append("")
        report.append("Recent Discord/log warnings:")
        interesting = [
            line
            for line in [*log_lines, *err_lines]
            if any(
                needle in line
                for needle in (
                    "[discord]",
                    "[health-monitor]",
                    "liveness warning",
                    "Embedded agent failed",
                    "401 status code",
                    "timed out",
                )
            )
        ][-args.include_log_tail :]
        report.extend(f"- {line[-220:]}" for line in interesting)

    return "\n".join(report).strip() + "\n", counts, gateway_probe, channels_status


def heal_is_ok(args: argparse.Namespace, counts: dict[str, int], gateway_probe: CmdResult) -> bool:
    if gateway_probe.code != 0:
        return False
    hard_failures = (
        counts.get("discord_heartbeat_timeout", 0),
        counts.get("discord_handshake_timeout", 0),
    )
    if any(value > 0 for value in hard_failures):
        return False
    return True


def send_report(report: str, args: argparse.Namespace) -> CmdResult:
    target = args.target or os.environ.get("OPENCLAW_HEALTH_DISCORD_TARGET")
    if not target:
        return CmdResult(2, "", "missing --target or OPENCLAW_HEALTH_DISCORD_TARGET")
    cmd = [OPENCLAW, "message", "send", "--channel", "discord", "--target", target]
    account = args.account_id or os.environ.get("OPENCLAW_HEALTH_DISCORD_ACCOUNT")
    if account:
        cmd.extend(["--account-id", account])
    cmd.extend(["--message", report])
    return run(cmd, timeout=args.send_timeout)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode",
        nargs="?",
        choices=("gateway", "bots", "heal"),
        default="gateway",
        help="Report mode used by cron jobs",
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--log", default=str(DEFAULT_LOG))
    parser.add_argument("--err-log", default=str(DEFAULT_ERR_LOG))
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--log-lines", type=int, default=240)
    parser.add_argument("--include-log-tail", type=int, default=12)
    parser.add_argument("--send", action="store_true", help="Post report to Discord via openclaw message send")
    parser.add_argument("--target", help="Discord target channel/user id or name")
    parser.add_argument("--account-id", help="Discord account id for sending")
    parser.add_argument("--send-timeout", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true", help="Print report but do not send")
    parser.add_argument(
        "--channels-probe",
        action="store_true",
        help="Run the deeper channels status probe (can be slow under gateway load)",
    )
    parser.add_argument(
        "--skip-channels-probe",
        action="store_true",
        help="Avoid the slower channels status probe (default for cron-safe reports)",
    )
    parser.add_argument(
        "--skip-channels-status",
        action="store_true",
        help="Avoid even the lightweight channels status snapshot",
    )
    args = parser.parse_args(argv)
    if args.mode == "heal":
        args.skip_channels_probe = True
        args.skip_channels_status = True
        args.include_log_tail = 0 if args.include_log_tail == 12 else args.include_log_tail
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    report, counts, gateway_probe, _channels_status = build_report(args)
    if args.mode == "heal" and heal_is_ok(args, counts, gateway_probe) and not args.send:
        print("HEARTBEAT_OK")
        return 0
    print(report, end="")
    if args.send and not args.dry_run:
        result = send_report(report, args)
        if result.code != 0:
            print(f"send failed: {result.stderr or result.stdout}".strip(), file=sys.stderr)
        return result.code
    if args.send and args.dry_run:
        target = args.target or os.environ.get("OPENCLAW_HEALTH_DISCORD_TARGET") or "<missing>"
        account = args.account_id or os.environ.get("OPENCLAW_HEALTH_DISCORD_ACCOUNT") or "default"
        print(f"dry-run send target={shlex.quote(target)} account={shlex.quote(account)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
