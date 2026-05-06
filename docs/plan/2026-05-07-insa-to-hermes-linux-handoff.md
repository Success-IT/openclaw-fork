# Insa To Hermes Linux Handoff Report

Date: 2026-05-07
Prepared for: follow-on migration agent
Scope: read-only source pull and experience import into an existing Linux Hermes setup

## Executive Summary

This is not an OpenClaw runtime clone. The target agent is a new Linux-based Hermes agent that should inherit Insa's operational experience, product knowledge, playbooks, skills, memory ledgers, and selected session history. It should not reuse Jensen's OpenClaw identity, gateway runtime, launchd services, device trust, bot sessions, or OAuth/token state.

The active Insa workspace is `/Users/jensen/insa`. The folder `/Users/jensen/Documents/insa` is effectively empty and is not the source of truth. The Insa workspace is a private git repo at `git@github.com:Success-IT/agent-insa.git`, currently `main...origin/main [ahead 4]` with substantial dirty and untracked state. A fresh clone from the remote is incomplete.

OpenClaw remains relevant only as provenance and as a source of archived config/session context. The current live OpenClaw runtime is `/Users/jensen/Documents/openclaw-worktrees/local-patches`, branch `maint/local-patches`, frozen on `v2026.4.24` plus 14 committed local patches and additional dirty fixes. Do not port OpenClaw as the runtime unless Jensen explicitly changes the goal.

## Source Of Truth Inventory

### Active Insa Workspace

- Path: `/Users/jensen/insa`
- Remote: `git@github.com:Success-IT/agent-insa.git`
- Branch state: `main...origin/main [ahead 4]`
- Recent commits:
  - `42993a7 Insa: freeze orchestration workspace tools`
  - `39b3d4c Insa: add bootstrap budget rule`
  - `3cc8898 Insa: shrink startup bootstrap files`
  - `74d59fd Insa: snapshot workspace before bootstrap cleanup`
  - `47c2c5f Insa: snapshot current workspace state`
- Important dirty tracked areas:
  - `AGENTS.md`, `TOOLS.md`, `DREAMS.md`
  - `memory/.dreams/*`
  - `memory/active-investigations.json`
  - `memory/agent-actions.json`
  - `memory/improvements.md`
  - `memory/workflow-metrics.json`
  - operational scripts such as `scripts/safe-gh.sh`, `scripts/send-discord-file.sh`, `scripts/record-build-artifact.sh`
  - skills such as `skills/create-pr/SKILL.md`, `skills/delegate-coding/SKILL.md`, `skills/pushprdev/SKILL.md`
- Important untracked areas:
  - recent daily logs under `memory/daily-log-2026-04-17.md` through `memory/daily-log-2026-05-06.md`
  - recent incident notes such as `memory/2026-05-05-purchase-order-bug.md`
  - `memory/GBRAIN-INSA-TRIAL.md`
  - `memory/cloudflare-status-watch.json`
  - `memory/session-notes.md`
  - `memory/dreaming/`
  - worktrees under `worktrees/`
  - many ticket-specific artifacts under `tmp/`

### Active OpenClaw Runtime Context

- Path: `/Users/jensen/Documents/openclaw-worktrees/local-patches`
- Remote: `git@github.com:Success-IT/openclaw-fork.git`
- Branch: `maint/local-patches`
- Head: `1d11ca405c Agents: repair sibling relay routing`
- Base: `v2026.4.24` / `upstream/release/2026.4.24`
- Patch queue: 14 commits on top of `v2026.4.24`
- Dirty tracked files cover Discord proxy behavior, dirty-tree rebuild detection, ACP lifecycle session IDs, session reset/recovery, tool result truncation, and message-tool timeout passthrough.
- Untracked runtime lock: `extensions/lmstudio/.openclaw-runtime-deps.lock/owner.json`; exclude it.

Use this OpenClaw data to explain why Jensen's current agent behaved a certain way. Do not make it part of the Linux Hermes runtime.

## Pull Manifest

Pull these from `/Users/jensen/insa` into the migration archive:

- Identity and instructions:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `TOOLS.md`
  - `SOUL.md`
  - `USER.md`
  - `HEARTBEAT.md`
  - `IDENTITY.md`
  - `MEMORY.md`
  - `DREAMS.md`
- Routing, product, and safety docs:
  - `DB-ACCESS.md`
  - `dev-access.md`
  - `config.yaml`
  - `channel-registry.json`
  - `channel-registry.json.bak-20260430-153500`
- Skills and procedures:
  - `skills/`
  - `playbooks/`
  - `scripts/`
- Durable memory and operations state:
  - `memory/`
  - `active-coding-tasks.json`
  - `tmp-active-investigations-updated.json`
  - `tmp-agent-actions-updated.json`
  - `tmp-hotfix-entry.json`
- Support reference material:
  - `INS-Support/`
  - `WS-Support/`
  - `archive/`
  - `mockups/`
- Product worktrees:
  - `worktrees/` only as archived reference. The target machine should use clean product repo checkouts as active codebases.

Pull these from `/Users/jensen/.openclaw` only as migration/reference inputs:

- `openclaw.json`
- `openclaw.json.last-good`
- `model-presets.json`
- `cron/jobs.json`
- `cron/jobs-state.json`
- `agents/insa/sessions/`
- `agents/insa/state.db`, if present
- Insa-related memory databases under `memory/`
- Insa-related QMD/session summary state when present

Pull this OpenClaw source metadata for provenance:

- `git log --oneline --decorate -16` from `/Users/jensen/Documents/openclaw-worktrees/local-patches`
- `git status --short --branch` from `/Users/jensen/Documents/openclaw-worktrees/local-patches`
- A patch export or bundle only if the target needs to inspect OpenClaw behavior, not to run the new Hermes identity.

## Exclusions

Do not copy or import these into the Linux Hermes identity:

- OpenClaw device identity and trust:
  - `.openclaw/identity/device.json`
  - `.openclaw/identity/device-auth.json`
  - `.openclaw/devices/paired.json`
- Local approvals and sockets:
  - `.openclaw/exec-approvals.json`
  - lock directories
  - tmp directories
- Live credentials/session material:
  - `.openclaw/auth-profiles.json`
  - `.openclaw/credentials/`
  - WhatsApp browser/session stores
  - Discord, Telegram, WhatsApp, OpenAI, Anthropic, Fireworks, Z.ai refresh/access tokens
- Runtime caches:
  - `.openclaw/plugin-runtime-deps/`
  - `.openclaw/browser/`
  - `.openclaw/tmp/`
  - `.openclaw/logs/`, unless specific logs are needed for audit
  - `.openclaw/media/`, unless specific evidence files are referenced by active investigations
- macOS service/runtime files:
  - launchd plist files
  - `.openclaw/service-env/ai.openclaw.gateway.env`
  - any `ai.openclaw.*` LaunchAgent definitions
- OpenClaw built output:
  - `dist/`
  - plugin runtime lock files
- Obvious Insa workspace noise:
  - `.DS_Store`
  - `.openclaw-smoke/`
  - `tmp/video-*` and transient frame dumps unless referenced by an active ticket
  - one-off generated upload folders unless referenced by `memory/active-investigations.json` or `memory/agent-actions.json`

Secrets must be re-created or reauthenticated on the target Linux machine.

## What Insa Was

Insa was a specialized Success IT engineering/support diagnostics agent. It triaged support issues, inspected product code and databases, coordinated PR work, and delegated implementation to coding agents. It was configured in OpenClaw as:

- Agent id/name: `insa` / `Insa`
- Primary model: `openai-codex/gpt-5.5`
- Workspace: `/Users/jensen/insa`
- Main channel: Discord account `Insa Bot`
- Tool surface: shell/process, message delivery, session tools, subagents, memory search/get
- Skills: `inspectdb-cli`, `querydb`, `run-safe-sql`, `investigate`, `readticket`, `create-migration`, `delegate-coding`, `report-debug`, `browser-verify`, `clarify-issue`, `rca-template`, `test-endpoint`, `create-pr`, `pushprdev`, and related support procedures

The new Hermes agent should inherit Insa's experience, but it must have a new identity. Phrase imported memory as inherited knowledge from Insa, not first-person continuity.

## Hermes Mapping Guidance

Create or use an isolated Hermes profile on Linux. The executor may choose the actual profile name, but this report assumes a profile like `success-diagnostics`.

Recommended mapping:

- New Hermes identity:
  - Start from a new `SOUL.md`, `USER.md`, and `IDENTITY.md`.
  - Use Insa's files as source material, not verbatim identity.
  - Include an explicit memory note: `This agent inherited operational experience from Jensen's Insa workspace snapshot dated 2026-05-07. It is not the original Insa runtime.`
- Workspace instructions:
  - Adapt `AGENTS.md` and `TOOLS.md` into the Hermes workspace context.
  - Remove or rewrite OpenClaw-only instructions such as `sessions_send`, OpenClaw channel metadata assumptions, launchd references, and macOS-only paths.
- Skills:
  - Install Insa skills under a namespace such as `~/.hermes/profiles/<profile>/skills/insa-imports/`.
  - Keep original skill names where possible.
  - Adjust hardcoded paths inside skills to Linux paths or environment variables.
- Memory:
  - Import high-signal summaries from `memory/improvements.md`, `memory/workflow-metrics.json`, `memory/sibling-agents.md`, `memory/coding-orchestrator.md`, and `memory/GBRAIN-INSA-TRIAL.md`.
  - Preserve full daily logs and raw ledgers as searchable workspace files.
  - Treat `memory/active-investigations.json`, `memory/agent-actions.json`, and `memory/zach-followup-queue.json` as durable state ledgers.
- Playbooks:
  - Keep `playbooks/` as reference docs in the workspace.
  - Preserve product-specific query pattern files such as `memory/exp-query-patterns.json`, `memory/ws-query-patterns.json`, `memory/ssql-query-patterns.json`, `memory/car-query-patterns.json`, and `memory/dms-query-patterns.json`.
- Cron:
  - Archive OpenClaw cron definitions for manual recreation.
  - Do not auto-enable Zach, Laylah, or OpenClaw watchdog jobs.
  - Recreate only a Hermes-native EOD journal or support workflow job after the new identity is verified.
- Sessions:
  - Use OpenClaw Insa sessions as reference/import material for search and summarization.
  - Do not assume raw session logs are complete or more authoritative than durable ledgers.

## Hardcoded Path Rewrite Table

The executor should scan imported files for these path families and rewrite them deliberately:

- `/Users/jensen/insa` -> Linux Insa experience workspace path
- `/Users/jensen/clawd` -> target Laylah/reference workspace path, or remove if not migrated
- `/Users/jensen/zach` -> target Zach reference workspace path, or remove if not migrated
- `/Users/jensen/Documents/clawdbot` -> OpenClaw source archive path, not runtime
- `/Users/jensen/Documents/openclaw-worktrees/local-patches` -> OpenClaw provenance archive path
- `/Users/jensen/Documents/insurance` -> target Insurance repo checkout path
- `/Users/jensen/Documents/Expat-Furniture` -> target Expat repo checkout path
- `/Users/jensen/Documents/Success-Workshop` -> target Workshop repo checkout path
- `/Users/jensen/Documents/hire-purchase` -> target Hire Purchase repo checkout path
- `/Users/jensen/Documents/dealer-management-system` -> target DMS repo checkout path
- `/Users/jensen/Documents/success-sql` -> target SuccessSQL repo checkout path
- `/Users/jensen/Documents/codegraph` -> target CodeGraph install/checkouts path
- `/Users/jensen/Documents/minion` -> target minion/delegation tooling path

Do not use symlinks to fake macOS paths on Linux unless the executor intentionally chooses that compatibility layer and documents it.

## Suggested Archive Shape

The executor can create a tarball or rsync staging directory shaped like:

```text
insa-hermes-migration/
  manifest.md
  insa-workspace/
  openclaw-reference/
    openclaw.json
    openclaw.json.last-good
    model-presets.json
    cron/
    agents/insa/
    local-patches-git-status.txt
    local-patches-git-log.txt
  excluded.txt
  checksums.txt
```

The `manifest.md` should record the exact source machine date, commit hashes, dirty file list, and whether untracked files were included.

## Execution Order For The Follow-On Agent

1. Stop treating `/Users/jensen/Documents/insa` as relevant; use `/Users/jensen/insa`.
2. Snapshot the Insa git repo including dirty and untracked state.
3. Snapshot selected OpenClaw reference/config/session state without secrets.
4. Build the migration archive with an explicit include/exclude manifest.
5. On Linux, import into an existing Hermes profile or equivalent isolated setup.
6. Rewrite paths and identity text before first real use.
7. Install imported Insa skills under a namespace.
8. Import or summarize durable memory ledgers.
9. Recreate only chosen Hermes-native cron jobs.
10. Reauthenticate providers, GitHub, Discord/messaging, and DB tooling with target-machine credentials.
11. Run verification before enabling gateway or scheduled automation.

## Verification Checklist

The follow-on agent should verify:

- The new Hermes identity does not claim to be original Insa.
- Imported skills are discoverable.
- The agent can explain Insa's product routing from `channel-registry.json`.
- The agent can summarize active investigations from `memory/active-investigations.json`.
- The agent can summarize durable PR/support actions from `memory/agent-actions.json`.
- The agent can find product playbooks for INS, WS, EXP, HP, CAR, SSQL, and DMS.
- No Jensen-local secrets were copied.
- No OpenClaw launchd/runtime service is required.
- Path rewrites are complete enough that scripts do not reference `/Users/jensen/...` unless they are intentionally archival examples.
- One safe read-only repo/search task works.
- One safe DB/tooling discovery command works if credentials are available in the target setup.
- Any recreated cron job is disabled until manually smoke-tested.

## Residual Risks

- Insa's session and memory state is large and partly dirty. Some context may exist only in untracked daily logs, `.dreams` files, or session archives.
- Many Insa scripts encode Jensen-specific paths and expectations about nearby product repos.
- OpenClaw active-memory/QMD/session search does not map one-to-one to Hermes memory. Prefer summarization and searchable archive import over opaque binary/SQLite transplant unless Hermes supports the same schema.
- The Insa repo has uncommitted operational changes; ignoring them will create an older and less capable version of the agent.
- Copying credentials would be unsafe and likely brittle. Reauthentication is required.

## Decision Defaults

- Runtime target: Linux Hermes, not OpenClaw.
- State target: inherited experience and durable ledgers, not live identity/session trust.
- Source priority: `/Users/jensen/insa` first, selected `/Users/jensen/.openclaw` second, OpenClaw patch queue only as provenance.
- Secrets policy: regenerate all secrets on target.
- Product code policy: use clean target checkouts; keep Insa `worktrees/` as archive/reference only.
