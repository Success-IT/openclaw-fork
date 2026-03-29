---
allowed-tools: Bash(cd:*), Bash(node:*), Bash(mkdir:*), Bash(ls:*), Read, Write
argument-hint: <ticket-number>
description: Sync ticket to local folder with RCA file for investigation and planning
---

# Sync Ticket Command

You are tasked with syncing a Success Catalyst ticket to a local folder structure for investigation. This creates an organized workspace with an RCA (Root Cause Analysis) markdown file for tracking investigation progress.

## Arguments

**Input**: $ARGUMENTS

Parse the arguments:

- First argument: Ticket number (e.g., "SII0009344", "SIH0001234")

**Examples**:

```
/syncticket SII0009344
/syncticket SIH0001234
```

## CLI Location

```
/Users/jensen/Documents/successcatalyst-cli/
```

## Product Folder Mapping

Based on the ticket project/category, determine the product folder:

| Project | Product         | Folder Path                                             |
| ------- | --------------- | ------------------------------------------------------- |
| SII     | Insurance       | `/Users/jensen/Documents/ins/SuccessInsurance-Req/`     |
| SIH     | Workshop        | `/Users/jensen/Documents/workshop/SuccessWorkshop-Req/` |
| CAR     | SuccessCar      | `/Users/jensen/Documents/car/SuccessCar-Req/`           |
| HP      | Hire Purchase   | `/Users/jensen/Documents/hp/SuccessHP-Req/`             |
| EFR     | Expat Furniture | `/Users/jensen/Documents/expat/Expat-Req/`              |
| GPS     | GPS Tracking    | `/Users/jensen/Documents/gps/GPS-Req/`                  |
| CAT     | Catalyst        | `/Users/jensen/Documents/catalyst/Catalyst-Req/`        |

**Default** (if project not matched): `/Users/jensen/Documents/workshop/SuccessWorkshop-Req/`

## Workflow

### Step 1: Check Authentication

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js auth status
```

### Step 2: Fetch Ticket Details

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket view <ticket-number> --output json
```

Extract:

- `Issuekey` - Ticket number
- `Summary` - Issue title
- `Description` - Full description
- `Status` - Current status
- `Assignee` - Assigned to
- `RequestByCompany` - Customer
- `RequestBy` - Contact
- `Priority` - Priority level
- `Category` - Issue category
- `DateEntry` - Created date
- `DueDate` - Due date

### Step 3: Fetch Comments

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket comments <ticket-number> --output json
```

### Step 4: Fetch Attachments List

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket attachments <ticket-number> --output json
```

### Step 5: Determine Product Folder

Based on the ticket prefix (SII, SIH, CAR, etc.) or project field, determine the correct base folder.

### Step 6: Create Folder Structure

```bash
# Create ticket folder
mkdir -p <base-folder>/<ticket-number>

# Create attachments subfolder
mkdir -p <base-folder>/<ticket-number>/attachments
```

### Step 7: Download Attachments

For each attachment:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket download <ticket-number> <attachment-id> -o <base-folder>/<ticket-number>/attachments/
```

### Step 8: Create RCA File

Create the RCA markdown file at `<base-folder>/<ticket-number>/<ticket-number>-rca.md`:

```markdown
# <ticket-number>: <Summary>

## Ticket Information

| Field        | Value              |
| ------------ | ------------------ |
| **Ticket**   | <Issuekey>         |
| **Status**   | <Status>           |
| **Priority** | <Priority>         |
| **Customer** | <RequestByCompany> |
| **Contact**  | <RequestBy>        |
| **Assignee** | <Assignee>         |
| **Category** | <Category>         |
| **Created**  | <DateEntry>        |
| **Due Date** | <DueDate>          |

## Description

<Description text - preserve formatting>

## Customer Comments

<List all comments from the ticket, with author and date>

---

## Investigation

### Root Cause Analysis

**Status**: [ ] Not Started | [ ] In Progress | [ ] Identified | [ ] Resolved

**Root Cause**:

> _To be determined during investigation_

### Affected Components

- [ ] Frontend (Angular)
- [ ] Backend (Azure Functions)
- [ ] Database (SQL Server)
- [ ] External API
- [ ] Configuration
- [ ] Other: \_\_\_

### Related Files

| File  | Purpose |
| ----- | ------- |
| _TBD_ | _TBD_   |

### Database Tables Involved

| Table | Database | Description |
| ----- | -------- | ----------- |
| _TBD_ | _TBD_    | _TBD_       |

---

## Resolution Plan

### Tasks

- [ ] Task 1: Investigate reported issue
- [ ] Task 2: Identify root cause
- [ ] Task 3: Implement fix
- [ ] Task 4: Test fix
- [ ] Task 5: Deploy to UAT
- [ ] Task 6: Customer verification
- [ ] Task 7: Deploy to Production

### Implementation Notes

_Document implementation details here..._

---

## Testing

### Test Cases

| #   | Scenario | Expected | Actual | Status |
| --- | -------- | -------- | ------ | ------ |
| 1   | _TBD_    | _TBD_    | _TBD_  | [ ]    |

### UAT Verification

- [ ] Tested in UAT environment
- [ ] Customer confirmed fix works

---

## Deployment

### Changes Made

| Type  | File/Object | Change Description |
| ----- | ----------- | ------------------ |
| _TBD_ | _TBD_       | _TBD_              |

### Deployment Checklist

- [ ] Code changes committed
- [ ] PR created and approved
- [ ] Deployed to UAT
- [ ] Deployed to Production
- [ ] Ticket updated with resolution
- [ ] Ticket closed

---

## Attachments

<List downloaded attachments with links>

| File | Description |
| ---- | ----------- |

<for each attachment>
| [<filename>](./attachments/<filename>) | _Attachment from ticket_ |
</for each>

---

## Activity Log

| Date    | Action        | Notes                              |
| ------- | ------------- | ---------------------------------- |
| <today> | Ticket synced | Initial sync from Success Catalyst |

---

_Last synced: <current datetime>_
_Synced by: Claude Code_
```

### Step 9: Report Success

> ✅ **Ticket Synced: `<ticket-number>`**
>
> **Folder created**: `<base-folder>/<ticket-number>/`
>
> **Files created**:
>
> - `<ticket-number>-rca.md` - RCA tracking document
> - `attachments/` - Downloaded attachments (<N> files)
>
> **Next steps**:
>
> 1. Review the RCA file to understand the issue
> 2. Start investigation by examining related code
> 3. Update the RCA file as you progress
> 4. Use `/updateticket` to sync progress back to Catalyst

## Re-sync Behavior

If the folder already exists:

1. **Prompt user**: "Folder already exists. What would you like to do?"
   - **Refresh**: Re-download ticket details and update RCA header (preserve investigation notes)
   - **Overwrite**: Delete and recreate everything
   - **Skip**: Keep existing folder as-is

2. If refresh mode:
   - Update ticket info section at top of RCA
   - Append new comments (check for duplicates)
   - Download any new attachments
   - Update "Last synced" timestamp

## Folder Structure

```
<base-folder>/
└── <ticket-number>/
    ├── <ticket-number>-rca.md    # Main RCA tracking file
    └── attachments/
        ├── screenshot1.png
        ├── error_log.txt
        └── ...
```

## Integration with Other Commands

This command is typically used after `/readticket`:

```
/readticket SII0009344      # View ticket details first
/syncticket SII0009344      # Create local workspace
# ... investigate and fix ...
/updateticket SII0009344 comment "Fixed. See RCA notes."
/updateticket SII0009344 status done
```

## Error Handling

- **Ticket not found**: Verify ticket number and try again
- **Permission denied**: Check folder permissions
- **Download failed**: Retry attachment downloads individually
- **Folder exists**: Prompt for overwrite/refresh/skip

## CLI Commands Reference

| Action              | Command                                                            |
| ------------------- | ------------------------------------------------------------------ |
| View ticket         | `node dist/index.js ticket view <key> --output json`               |
| List comments       | `node dist/index.js ticket comments <key> --output json`           |
| List attachments    | `node dist/index.js ticket attachments <key> --output json`        |
| Download attachment | `node dist/index.js ticket download <key> <filename> --dir <path>` |
