---
allowed-tools: Bash(cd:*), Bash(node:*), Bash(mkdir:*), Bash(base64:*), Read, Write
argument-hint: <ticket-number>
description: Read ticket details, view images in base64, and download attachments from Success Catalyst
---

# Read Ticket Command

You are tasked with reading a support ticket from Success Catalyst, including its details, comments, images, and attachments.

## Arguments

**Input**: $ARGUMENTS

Parse the arguments:

- First argument: Ticket number (e.g., "SII0009344", "SIH0001234")

**Examples**:

```
/readticket SII0009344
/readticket SIH0001234
```

## CLI Location

```
/Users/jensen/Documents/successcatalyst-cli/
```

## Workflow

### Step 1: Check Authentication

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js auth status
```

If not authenticated, inform the user:

> "You need to authenticate first. Run:
>
> ````
> node dist/index.js auth login -e prod -u <username> -p '<password>' --non-interactive
> ```"
> ````

### Step 2: Get Ticket Details

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket view <ticket-number> --output json
```

Parse the JSON response and extract:

- `Issuekey` - Ticket number
- `Summary` - Issue title
- `Description` - Full description
- `Status` - Current status
- `Assignee` - Who it's assigned to
- `RequestByCompany` - Customer/company
- `RequestBy` - Contact person
- `DueDate` - Due date
- `DateEntry` - Created date
- `Priority` - Priority level
- `Category` - Issue category

### Step 3: Get Ticket Comments

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket comments <ticket-number> --output json
```

Display comments in chronological order with:

- Author
- Date
- Comment text

### Step 4: Get Ticket Attachments

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket attachments <ticket-number> --output json
```

List all attachments with:

- Filename
- File size
- Upload date
- Uploader

### Step 5: Download Attachments (If Requested)

If user wants to download attachments:

```bash
# Create downloads folder
mkdir -p /Users/jensen/Documents/workshop/ticket-attachments/<ticket-number>

# Download specific attachment
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket download <ticket-number> <attachment-id> -o /Users/jensen/Documents/workshop/ticket-attachments/<ticket-number>/
```

### Step 6: Extract Embedded Base64 Images from Description

**IMPORTANT**: Ticket descriptions often contain embedded base64 images (screenshots from emails). These are crucial for understanding the issue. Follow this workflow to extract and view them:

#### Step 6a: Save Full JSON to Avoid Truncation

The ticket JSON output can be truncated in terminal. Always save to a temp file first:

```bash
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket view <ticket-number> --output json > /tmp/<ticket-number>-full.json
```

#### Step 6b: Check for Base64 Images in Description

```bash
# Check if description contains base64 image data
node -e "const j=require('/tmp/<ticket-number>-full.json'); console.log(j.Description && j.Description.includes('base64') ? 'HAS_BASE64_IMAGE' : 'NO_IMAGE')"
```

#### Step 6c: Extract Base64 Image Data

If base64 image exists, extract it:

```bash
# Extract base64 data from the Description field (handles data:image/png;base64, format)
node -e "
const fs = require('fs');
const j = require('/tmp/<ticket-number>-full.json');
const desc = j.Description || '';
const match = desc.match(/data:image\/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+\/=]+)/);
if (match) {
  fs.writeFileSync('/tmp/<ticket-number>-image.b64', match[2]);
  console.log('Extracted base64 to /tmp/<ticket-number>-image.b64');
  console.log('Image type: ' + match[1]);
} else {
  console.log('No base64 image found in description');
}
"
```

#### Step 6d: Decode Base64 to Image File

On macOS, use:

```bash
base64 -D -i /tmp/<ticket-number>-image.b64 -o /tmp/<ticket-number>-screenshot.png
```

On Linux, use:

```bash
base64 -d /tmp/<ticket-number>-image.b64 > /tmp/<ticket-number>-screenshot.png
```

#### Step 6e: View the Image

Use the Read tool to view the decoded image:

```
Read: /tmp/<ticket-number>-screenshot.png
```

Claude can view images directly and describe what the screenshot shows.

### Step 7: View Attachment Images

For image attachments (.png, .jpg, .jpeg, .gif, .webp):

```bash
# Download the image first
cd /Users/jensen/Documents/successcatalyst-cli && node dist/index.js ticket download <ticket-number> <attachment-id> -o /tmp/

# View using Read tool
```

Then use the Read tool to view the image file directly (Claude can view images).

## Report Format

Present the ticket information in a clear format:

> **Ticket: `<Issuekey>`**
>
> | Field    | Value                |
> | -------- | -------------------- |
> | Summary  | `<Summary>`          |
> | Status   | `<Status>`           |
> | Assignee | `<Assignee>`         |
> | Customer | `<RequestByCompany>` |
> | Contact  | `<RequestBy>`        |
> | Priority | `<Priority>`         |
> | Category | `<Category>`         |
> | Due Date | `<DueDate>`          |
> | Created  | `<DateEntry>`        |
>
> **Description**:
>
> ```
> <Description text>
> ```
>
> **Comments** (X total):
>
> ---
>
> **`<Author>`** - `<Date>`
> `<Comment text>`
>
> ---
>
> **Attachments** (X total):
> | # | Filename | Size | Date |
> |---|----------|------|------|
> | 1 | `<filename>` | `<size>` | `<date>` |
>
> **Embedded Screenshots**: [If base64 images found in description, extract and display them]
>
> [Images will be displayed inline with description of what they show]

## Follow-up Actions

After displaying ticket details, offer:

> "What would you like to do next?
>
> 1. **Download attachments** - Save files locally
> 2. **View image** - Display a specific image attachment
> 3. **Sync ticket** - Create local folder with RCA file (`/syncticket <ticket-number>`)
> 4. **Update ticket** - Add comment or change status (`/updateticket`)
> 5. **Investigate** - Query relevant databases for more context"

## Error Handling

- **Ticket not found**: Verify ticket number format and try again
- **No attachments**: Report that ticket has no attachments
- **Download failed**: Check network and authentication
- **Image too large**: Report size and offer to download instead of base64

## CLI Commands Reference

| Action              | Command                                                            |
| ------------------- | ------------------------------------------------------------------ |
| View ticket         | `node dist/index.js ticket view <key> --output json`               |
| List comments       | `node dist/index.js ticket comments <key> --output json`           |
| List attachments    | `node dist/index.js ticket attachments <key> --output json`        |
| Download attachment | `node dist/index.js ticket download <key> <filename> --dir <path>` |
| Search tickets      | `node dist/index.js ticket search "<query>" --limit 10`            |

**Important Notes**:

- Ticket descriptions often contain base64-encoded screenshots from customer emails
- Always save the full JSON to a temp file first to avoid truncation
- Use the Step 6 workflow to extract and decode embedded images
- On macOS: use `base64 -D -i <input> -o <output>` (not `base64 -d`)
- On Linux: use `base64 -d <input> > <output>`
- Claude can view images directly using the Read tool - describe what you see
