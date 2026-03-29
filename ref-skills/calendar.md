---
allowed-tools: Bash(mgc:*), Bash(cat:*), Bash(python3:*)
argument-hint: [action] [details] — e.g., "list", "create meeting with Nathan tomorrow 2pm"
description: Manage Jensen's calendar (jensen@successit.com.sg) using Microsoft Graph CLI
---

# Calendar Manager

You are tasked with managing Jensen's calendar using the Microsoft Graph CLI (mgc).

## Prerequisites

Jensen is already authenticated with mgc as jensen@successit.com.sg. No login is required.

## Arguments

**Action and details**: $ARGUMENTS

If no arguments provided, show today's agenda.

## Quick Reference - MGC Syntax

**CRITICAL**: Always use `=` to connect option and value (e.g., `--user-id=me`, `--top=10`). Do NOT use space between option and value.

## Time Zone

Jensen is in **Singapore (Asia/Singapore, SGT, UTC+8)**. All times should be interpreted and displayed in SGT unless otherwise specified.

## Instructions

### 1. List Events (Default Action)

**Today's agenda** (no arguments or "today"):

```bash
START=$(date -u +"%Y-%m-%dT00:00:00Z")
END=$(date -u -v+1d +"%Y-%m-%dT00:00:00Z")
mgc users calendar-view list --user-id=me --start-date-time="$START" --end-date-time="$END" --select="id,subject,start,end,location,attendees,isOnlineMeeting,onlineMeetingUrl" --orderby="start/dateTime" 2>&1
```

**This week**:

```bash
START=$(date -u +"%Y-%m-%dT00:00:00Z")
END=$(date -u -v+7d +"%Y-%m-%dT00:00:00Z")
mgc users calendar-view list --user-id=me --start-date-time="$START" --end-date-time="$END" --select="id,subject,start,end,location,attendees" --orderby="start/dateTime" 2>&1
```

**Specific date** (e.g., "tomorrow", "next Monday"):

```bash
# Calculate the target date and use it for START/END
mgc users calendar-view list --user-id=me --start-date-time="<DATE>T00:00:00Z" --end-date-time="<DATE>T23:59:59Z" --select="id,subject,start,end,location,attendees" --orderby="start/dateTime" 2>&1
```

### 2. Display Events

Present events in a clear format:

```
📅 Calendar — [Date Range]
===========================

1. [TIME] Subject
   📍 Location (if any)
   👥 Attendees: Name1, Name2
   🔗 Online meeting link (if any)
   ID: EVENT_ID

2. ...
```

### 3. Create Events

When asked to create an event, gather:

- Subject/title
- Start time and end time (or duration)
- Location (optional)
- Attendees (optional)
- Description/body (optional)

**Create an event**:

```bash
cat << 'JSONEOF' > /tmp/event.json
{
  "subject": "Meeting title",
  "start": {
    "dateTime": "2024-01-15T14:00:00",
    "timeZone": "Asia/Singapore"
  },
  "end": {
    "dateTime": "2024-01-15T15:00:00",
    "timeZone": "Asia/Singapore"
  },
  "location": {
    "displayName": "Conference Room A"
  },
  "attendees": [
    {
      "emailAddress": {
        "address": "attendee@example.com",
        "name": "Attendee Name"
      },
      "type": "required"
    }
  ],
  "body": {
    "contentType": "html",
    "content": "<p>Meeting description</p>"
  }
}
JSONEOF

mgc users events create --user-id=me --body="$(cat /tmp/event.json)" 2>&1
```

**Create with Teams meeting**:
Add `"isOnlineMeeting": true` and `"onlineMeetingProvider": "teamsForBusiness"` to the JSON.

### 4. Update Events

**Reschedule or modify an event**:

```bash
cat << 'JSONEOF' > /tmp/event_update.json
{
  "start": {
    "dateTime": "2024-01-15T15:00:00",
    "timeZone": "Asia/Singapore"
  },
  "end": {
    "dateTime": "2024-01-15T16:00:00",
    "timeZone": "Asia/Singapore"
  }
}
JSONEOF

mgc users events patch --user-id=me --event-id="<EVENT_ID>" --body="$(cat /tmp/event_update.json)" 2>&1
```

### 5. Delete/Cancel Events

**Delete an event**:

```bash
mgc users events delete --user-id=me --event-id="<EVENT_ID>" 2>&1
```

Before deleting, confirm with the user: "Are you sure you want to delete '[Event Subject]'?"

### 6. Accept/Decline Invitations

**Accept**:

```bash
mgc users events accept post --user-id=me --event-id="<EVENT_ID>" --body='{"sendResponse": true}' 2>&1
```

**Decline**:

```bash
mgc users events decline post --user-id=me --event-id="<EVENT_ID>" --body='{"sendResponse": true}' 2>&1
```

**Tentative**:

```bash
mgc users events tentatively-accept post --user-id=me --event-id="<EVENT_ID>" --body='{"sendResponse": true}' 2>&1
```

### 7. Check Free/Busy

**Check availability**:

```bash
cat << 'JSONEOF' > /tmp/freebusy.json
{
  "schedules": ["jensen@successit.com.sg"],
  "startTime": {
    "dateTime": "2024-01-15T00:00:00",
    "timeZone": "Asia/Singapore"
  },
  "endTime": {
    "dateTime": "2024-01-15T23:59:59",
    "timeZone": "Asia/Singapore"
  }
}
JSONEOF

mgc users calendar get-schedule post --user-id=me --body="$(cat /tmp/freebusy.json)" 2>&1
```

## Known Contacts

When creating events with attendees, use these known addresses:

- **Jensen (work)**: jensen@successit.com.sg
- **Michelle (wife)**: michelle.yz.chin@gmail.com
- **Jackson**: jackson@successit.com.sg
- **Khang Ling**: khangling@successit.com.sg
- **Nathan Tee**: chunxiang.tee@gmail.com

### 8. Check Team Calendar (Group Calendar)

**Query team/group calendar** for availability, leave, and team events:

```bash
mgc groups calendar-view list --group-id=afad93b8-00c1-4a36-9846-4930dfdd7fbf \
  --start-date-time="<START>T00:00:00+08:00" \
  --end-date-time="<END>T23:59:59+08:00" \
  --select="id,subject,start,end,organizer,isAllDay" \
  --orderby="start/dateTime" --top=200 --output RAW_JSON 2>&1
```

Use this when:

- Scheduling new events: check who's on leave/WFH before proposing times
- Answering "who's in the office?" or "who's on leave?" questions
- Cross-referencing team events to identify FYI items vs real meetings on Jensen's calendar

Team availability keywords in subjects: leave, wfh, mc, ooo, out of office, work from home, annual leave, medical.

Events organized by `SuccessIT_all@o365.successit.net` are team-wide markers (not Jensen's meetings).

## Error Handling

- If mgc returns an authentication error, inform user to run `mgc login` first
- If event creation fails, check JSON syntax and required fields
- If event not found, re-list events and ask user to select again

## Example Usage

```
/calendar                              # Show today's agenda
/calendar tomorrow                     # Show tomorrow's events
/calendar this week                    # Show this week's events
/calendar create meeting with Nathan tomorrow 2pm for 1 hour
/calendar reschedule <event> to Friday 3pm
/calendar cancel <event>
/calendar accept <event>
```
