---
allowed-tools: Bash(mgc:*), Bash(cat:*), Bash(python3:*)
argument-hint: [search term] or [sender name/email]
description: Search and read emails for jensen@successit.com.sg using Microsoft Graph CLI
---

# Email Reader Command

You are tasked with searching and reading emails for jensen@successit.com.sg using the Microsoft Graph CLI (mgc).

## Prerequisites

The user is already authenticated with mgc as jensen@successit.com.sg. No login is required.

## Arguments

**Search query**: $ARGUMENTS

If no arguments provided, list the 10 most recent emails.

## Quick Reference - MGC Syntax

**CRITICAL**: Always use `=` to connect option and value (e.g., `--user-id=me`, `--top=10`). Do NOT use space between option and value.

## Instructions

### 1. Search for Emails

**If search term provided**, search Inbox emails:

```bash
mgc users mail-folders messages list --user-id=me --mail-folder-id=inbox --search="$ARGUMENTS" --top=20 --select="id,subject,from,receivedDateTime,bodyPreview" 2>&1
```

**If no search term**, list recent Inbox emails:

```bash
mgc users mail-folders messages list --user-id=me --mail-folder-id=inbox --top=10 --select="id,subject,from,receivedDateTime,bodyPreview" --orderby="receivedDateTime desc" 2>&1
```

**Note**: The search parameter doesn't support special characters like `:` or `.` directly. If searching for an email address or domain:

- Search for a keyword instead (e.g., search for "verify" instead of "verify.apac@fadv.com")
- Or search for sender name
- Keep list and search scoped to `inbox`. In this mailbox, `mgc users messages list --user-id=me ...` can return repeated HTTP 503 errors, while the folder-scoped Inbox path remains stable.

### 2. Display Results

Present the results in a clear format:

```
📧 Email Results
================

1. [DATE] From: SENDER_NAME <SENDER_EMAIL>
   Subject: SUBJECT
   Preview: BODY_PREVIEW (first 100 chars)
   ID: MESSAGE_ID

2. ...
```

### 3. Ask User Which Email to Read

After showing results, ask:

> "Which email would you like to read? Enter the number (1, 2, 3...) or 'none' to cancel."

### 4. Fetch Full Email Content

Once user selects an email, fetch the full content:

```bash
mgc users messages get --user-id=me --message-id="<MESSAGE_ID>" --select="subject,from,toRecipients,ccRecipients,receivedDateTime,body" 2>&1
```

### 5. Extract and Display Email Body

The body is returned as HTML. Extract readable text:

```bash
cat "<output_file>" | python3 -c "import sys, json, html, re; data = json.load(sys.stdin); content = data['body']['content']; text = re.sub(r'<[^>]+>', ' ', html.unescape(content)); print(' '.join(text.split()))"
```

Display the email in a readable format:

```
📧 Full Email
=============
From: SENDER_NAME <SENDER_EMAIL>
To: RECIPIENTS
CC: CC_RECIPIENTS (if any)
Date: RECEIVED_DATE
Subject: SUBJECT

--- Body ---
<extracted text content>
```

### 6. Offer Follow-up Actions

After displaying the email, ask:

> "What would you like to do?
>
> 1. Reply to this email
> 2. Search for another email
> 3. Done"

If user wants to reply:

- Store the message ID for use with `mgc users messages create-reply post`
- Ask user what they want to say in the reply
- Create a draft reply using HTML formatting for proper line breaks

## Creating a Reply Draft

When creating a reply, use proper HTML formatting:

```bash
cat << 'JSONEOF' > /tmp/reply_body.json
{
  "message": {
    "body": {
      "contentType": "html",
      "content": "<html><body><p>Your reply content here with proper <br/> tags for line breaks</p></body></html>"
    }
  }
}
JSONEOF

mgc users messages create-reply post --user-id=me --message-id="<MESSAGE_ID>" --body="$(cat /tmp/reply_body.json)" 2>&1
```

## Error Handling

- If mgc returns an authentication error, inform user to run `mgc login` first
- If search returns no results, suggest alternative search terms
- If message ID is invalid, re-list emails and ask user to select again

## Example Usage

```
/reademail                          # List 10 most recent emails
/reademail verify                   # Search for emails containing "verify"
/reademail invoice                  # Search for emails about invoices
/reademail Kenneth                  # Search for emails from/about Kenneth
```
