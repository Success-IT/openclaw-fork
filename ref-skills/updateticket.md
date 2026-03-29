---
allowed-tools: Bash(cd:*), Bash(node:*), Bash(ls:*), Read
argument-hint: <ticket-number> [action] [value]
description: Update ticket status, assignee, comments, and upload images to Success Catalyst
---

# Update Ticket Command

You are tasked with updating a support ticket in Success Catalyst - adding comments, changing status, reassigning, or uploading attachments.

## Arguments

**Input**: $ARGUMENTS

Parse the arguments:

- First argument: Ticket number (e.g., "SII0009344")
- Second argument (optional): Action type (comment, status, assign, upload)
- Third argument (optional): Value for the action

**Examples**:

```
/updateticket SII0009344 comment "Fixed the issue by updating the stored procedure"
/updateticket SII0009344 status ip
/updateticket SII0009344 assign jianzhi
/updateticket SII0009344 upload /path/to/screenshot.png
/updateticket SII0009344
```

If only ticket number provided, enter interactive mode.

## CLI Location

```
/Users/jensen/Documents/successcatalyst-cli/
```

## Workflow

### Step 1: Check Authentication

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js auth status
```

If not authenticated, inform the user to authenticate first.

### Step 2: Verify Ticket Exists

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket view <ticket-number> --output json
```

Show current ticket status before any updates:

> **Current State of `<ticket-number>`**:
>
> - Status: `<Status>`
> - Assignee: `<Assignee>`
> - Last Updated: `<DateModify>`

### Step 3: Perform Action

#### Action: Add Comment

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket comment <ticket-number> "<comment-text>"
```

For multi-line comments, use heredoc:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket comment <ticket-number> "$(cat <<'EOF'
Line 1 of comment
Line 2 of comment

Code block:
SELECT * FROM table;
EOF
)"
```

#### Action: Change Status

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket status <ticket-number> <status-code>
```

**Status Codes**:
| Code | Status | Description |
|------|--------|-------------|
| `backlog` | Backlog | Work not yet started |
| `todo` | To Do | Ready to start |
| `ip` | In Progress | Currently being worked on |
| `done` | Done | Completed |
| `cancelled` | Cancelled | No longer needed |
| `kiv` | Keep In View | On hold/monitoring |

**Note:** For "waiting for customer reply", use `kiv` + add a comment explaining the wait.

#### Action: Reassign

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket assign <ticket-number> <username>
```

**Common Assignees**:

- `jensen` - Jensen
- `jianzhi` - Jian Zhi
- `weiming` - Wei Ming
- `yewwei` - Yew Wei

#### Action: Upload Image/Attachment

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket attach <ticket-number> <file-path>
```

**Supported file types**: .png, .jpg, .jpeg, .gif, .pdf, .xlsx, .docx, .txt, .sql, .log

#### Action: Update Priority

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket priority <ticket-number> <priority>
```

**Priority Levels**: `low`, `medium`, `high`, `critical`

#### Action: Update Due Date

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket duedate <ticket-number> <YYYY-MM-DD>
```

### Interactive Mode

If no action specified, ask the user:

> **Update Ticket `<ticket-number>`**
>
> Current: Status=`<Status>`, Assignee=`<Assignee>`
>
> What would you like to do?
>
> 1. **Comment** - Add a comment
> 2. **Status** - Change status (backlog/todo/ip/done/cancelled/kiv)
> 3. **Assign** - Reassign to someone
> 4. **Upload** - Upload file/image
> 5. **Priority** - Change priority
> 6. **Due Date** - Update due date
>
> Please specify action and value.

## Report Format

After each update, confirm the action:

> ✅ **Ticket Updated: `<ticket-number>`**
>
> | Action     | Result        |
> | ---------- | ------------- |
> | `<action>` | `<new-value>` |
>
> View ticket: `/readticket <ticket-number>`

## Bulk Operations

For updating multiple tickets at once:

```
/updateticket SII0009344,SII0009345,SII0009346 status done
```

The command will iterate through each ticket and apply the same action.

## Common Workflows

### Mark Ticket as In Progress and Add Comment

```
/updateticket SII0009344 status ip
/updateticket SII0009344 comment "Starting investigation"
```

### Complete Ticket with Resolution Notes

```
/updateticket SII0009344 comment "Fixed by updating sp_GetReport stored procedure. Root cause was missing NULL check."
/updateticket SII0009344 status done
```

### Reassign with Handoff Notes

```
/updateticket SII0009344 comment "Reassigning to Jian Zhi for database-level investigation"
/updateticket SII0009344 assign jianzhi
```

### Upload Screenshot with Context

```
/updateticket SII0009344 upload /tmp/error-screenshot.png
/updateticket SII0009344 comment "Attached screenshot showing the error. Occurs when clicking Save."
```

## Error Handling

- **Invalid status**: Show valid status codes
- **User not found**: Show valid assignee usernames
- **File not found**: Verify file path exists
- **Upload failed**: Check file size (max 10MB) and format
- **Permission denied**: Verify you have edit rights on the ticket

## CLI Commands Reference

| Action        | Command                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| Add comment   | `node dist/index.js ticket comment <key> "<text>"`                            |
| Change status | `node dist/index.js ticket status <key> <code>`                               |
| Update fields | `node dist/index.js ticket update <key> --assignee <user> --priority <level>` |
| Upload file   | `node dist/index.js ticket attach <key> <path>`                               |
| Log time      | `node dist/index.js ticket timelog <key> <time>` (e.g., 30m, 1h, 1h30m)       |
| View timelogs | `node dist/index.js ticket timelogs <key>`                                    |
