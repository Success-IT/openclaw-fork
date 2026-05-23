---
name: obsidian-vault
description: |
  Read from and write to Jensen's Jensen2 Obsidian vault. Use this skill when:
  - The user says "file this in my vault", "update my vault", "put this in Obsidian"
  - The user asks to update their profile, project pages, or knowledge notes
  - The user asks to create a brief, report, or output in the vault
  - Reading vault context is needed before answering questions about projects, people, or concepts
  - The user says "sync this to my vault" or "update my Obsidian"
  Do NOT use for the automated EOD sync (handled by obsidian_eod_sync.py cron).
---

# Obsidian Vault Skill

## Vault Location

`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Jensen2/`

This is an iCloud-synced vault. Files may occasionally be locked with "Resource deadlock avoided" when iCloud is syncing. Retries or brief waits usually resolve this.

## Governance

Always follow `AGENTS.md` rules in the vault root:

- **Human-owned (write-only):** `01 Inbox/`, `02 Daily/`, `03 Weekly/` — agent may append metadata but never overwrites human text
- **Shared (collaboration):** `10 Domains/`, `20 Projects/` — agent maintains status, links, related materials; human creates/updates pages
- **Agent-owned (human read-only):** `30 Knowledge/`, `40 Outputs/`, `90 System/Indexes/` — agent has full write access
- **System:** `90 System/Templates/`, `90 System/Prompts/`, `90 System/Policies/` — both may add

## Conventions

### YAML Frontmatter (required on all notes)

```yaml
---
title: "Note Title"
type: domain|project|concept|person|company|place|source|output|index|daily
date_created: YYYY-MM-DD
date_updated: YYYY-MM-DD
tags: [tag1, tag2]
status: active|archived|draft
---
```

### Wiki Links

Use `[[Like This]]` for any person, project, concept, or note reference. Minimum 3 backlinks per knowledge note.

### Confidence Marking

- **High:** Direct quotes, verified facts → no special marking needed
- **Medium:** Reasonable inferences → mark with `[Inference]`
- **Low:** Speculation → mark with `[Speculation]`

### Naming

- Domain notes: lowercase with hyphens
- Projects: `YYYY-MM-DD-project-name.md` for active, `project-name.md` for evergreen
- Concepts: Title case, no dates
- People: `First Last.md`
- Companies: Official names

## Write Rules

1. **Never delete human content.** Mark as `status: archived` instead.
2. **Preserve source links.** Every compiled note links back to source.
3. **Use atomic commits.** One concept per note in `30 Knowledge/Concepts/`.
4. **Update `date_updated` on every edit.**
5. **Separate facts from inferences.**
6. **Output files go to `40 Outputs/` unless promoted by human request.**
7. **Raw sources stay in `30 Knowledge/Sources/` with minimal processing.**
8. **When uncertain:** ask, file to inbox with comment, or create draft marked `[DRAFT - REVIEW NEEDED]`.

## iCloud Deadlock Handling

If a file read/write fails with "Resource deadlock avoided":

1. Wait 2-3 seconds
2. Retry once
3. If still failing, copy the file to `/tmp/` first, then read from there
4. For writes, write to `/tmp/` first, then `cp` to vault path

## Helper Script

Use `scripts/vault_rw.py` for reliable read/write operations with deadlock handling.

```bash
# Read a file
python3 ~/clawd/skills/obsidian-vault/scripts/vault_rw.py read "30 Knowledge/People/Jensen Loke.md"

# Write/update a file (full content)
python3 ~/clawd/skills/obsidian-vault/scripts/vault_rw.py write "40 Outputs/Briefs/my-brief.md" --content "..."

# Update frontmatter only
python3 ~/clawd/skills/obsidian-vault/scripts/vault_rw.py update-frontmatter "30 Knowledge/People/Jensen Loke.md" --date-updated 2026-05-17
```
