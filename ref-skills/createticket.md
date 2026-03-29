---
allowed-tools: Bash(cd:*), Bash(node:*), Bash(npm:*), Read, mcp__sics_WS_Prod__read_query, mcp__sics_WS_Prod__describe_table
argument-hint: <customer-name> "<issue-summary>" [assignee]
description: Create a support ticket via SuccessCatalyst CLI with customer lookup and auto-populated fields
---

# Create Support Ticket Command

You are tasked with creating a support ticket using the SuccessCatalyst CLI tool. This command handles authentication, customer lookup, and ticket creation.

## Arguments

**Input**: $ARGUMENTS

Parse the arguments:

- First argument: Customer name or code (e.g., "super autoparts" or "S069")
- Second argument (quoted): Issue summary/title
- Third argument (optional): Assignee username (defaults to current user from auth)

**Examples**:

```
/createticket "super autoparts" "Update Last Cost dialog shows empty items"
/createticket S069 "GRN posting error" jianzhi
/createticket "cogent" "Cannot print invoice" jensen
```

## CLI Location

```
/Users/jensen/Documents/successcatalyst-cli/
```

## Workflow

### Step 1: Check CLI Build Status

First, verify the CLI is built:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && test -f dist/index.js && echo "CLI is built" || echo "CLI needs building"
```

If not built, build it:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && npm run build
```

### Step 2: Check Authentication Status

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js auth status
```

**If not authenticated**, inform the user they need to provide credentials:

> "You are not authenticated. Please provide your credentials:
>
> - Environment: (uat or prod)
> - Username:
> - Password:
>
> Example: `login to prod with username jensen password MyPass123`"

Wait for the user to provide credentials, then run:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js auth login -e <env> -u <username> -p '<password>' --non-interactive
```

### Step 3: Search for Customer

Use the CLI to find the customer:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js customer search "<customer-name>" --output json
```

**Parse the JSON response** to extract:

- `TraderCode` - The customer code (e.g., "S069")
- `TraderName` - The full company name (e.g., "SUPER AUTOPARTS PTE LTD")
- `Attn` - Default contact person
- `HandPhone` - Contact phone

**If no customer found**, ask the user:

> "Customer '<search-term>' not found. Would you like to:
>
> 1. Try a different search term
> 2. Proceed without customer (will set RequestByCompany to the provided value)"

### Step 4: Confirm Ticket Details

Show the user the ticket details before creation:

> **Create Ticket Confirmation**
>
> | Field    | Value                           |
> | -------- | ------------------------------- |
> | Summary  | `<issue-summary>`               |
> | Customer | `<TraderName>` (`<TraderCode>`) |
> | Contact  | `<Attn or '-'>`                 |
> | Assignee | `<assignee>`                    |
> | Project  | SIH                             |
> | Due Date | `<7 days from today>`           |
>
> Proceed? (yes/no)

Wait for user confirmation.

### Step 5: Create the Ticket

Run the CLI command:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket create \
  -s "<issue-summary>" \
  -a <assignee> \
  -c "<TraderCode-or-customer-name>" \
  --request-by "<Attn-or-dash>" \
  --project SIH \
  --output json
```

### Step 6: Report Results

Parse the JSON response and report:

**On Success**:

> ✅ **Ticket Created Successfully**
>
> | Field     | Value                |
> | --------- | -------------------- |
> | Issue Key | `<Issuekey>`         |
> | Summary   | `<Summary>`          |
> | Customer  | `<RequestByCompany>` |
> | Assignee  | `<Assignee>`         |
> | Status    | `<Status>`           |
> | Due Date  | `<DueDate>`          |
>
> View ticket: `node dist/index.js ticket view <Issuekey>`

**On Failure**:

> ❌ **Ticket Creation Failed**
>
> Error: `<error-message>`
>
> Please check:
>
> - Authentication status
> - Customer exists
> - Required fields are provided

## Optional: Add Description

If the user wants to add a detailed description, they can include it:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket create \
  -s "<summary>" \
  -d "<detailed-description>" \
  -a <assignee> \
  -c "<customer>" \
  --output json
```

## Quick Commands Reference

| Action          | Command                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Check auth      | `node dist/index.js auth status`                                            |
| Login           | `node dist/index.js auth login -e prod -u USER -p 'PASS' --non-interactive` |
| Search customer | `node dist/index.js customer search "name" --output json`                   |
| Create ticket   | `node dist/index.js ticket create -s "Summary" -a USER -c "Customer"`       |
| View ticket     | `node dist/index.js ticket view ISSUEKEY`                                   |
| Add comment     | `node dist/index.js ticket comment ISSUEKEY "message"`                      |
| Change status   | `node dist/index.js ticket status ISSUEKEY ip`                              |

## Status Shortcuts

- `backlog` → Backlog (default for new tickets)
- `todo` → To Do
- `ip` → In Progress
- `done` → Done
- `cancelled` → Cancelled
- `kiv` → Keep In View

## Database Investigation (Optional)

If you need to investigate issues before creating the ticket, you can query the production databases using MCP tools:

- `sics_WS_Prod` - Success IT's internal ticket database (for viewing existing tickets)
- Other tenant databases for investigating customer-specific issues

**Always ask for user permission before querying production databases.**

## Error Handling

- **Authentication expired**: Re-authenticate with `auth login`
- **Customer not found**: Try different search terms or use customer code directly
- **API error**: Check network connectivity and try again
- **Missing required fields**: Ensure summary and assignee are provided

## Follow-up Actions

After creating a ticket, offer these options:

> "Ticket `<Issuekey>` created. Would you like to:
>
> 1. View the ticket details
> 2. Add a comment
> 3. Assign to someone else
> 4. Change the status"
