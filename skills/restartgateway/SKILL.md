---
name: restartgateway
description: Restart the OpenClaw gateway to apply configuration changes
allowed-tools:
  - Bash
---

# Restart Gateway Skill

Restarts the OpenClaw gateway cleanly and verifies it's running.

## Usage

```
/restartgateway
```

## What It Does

1. Kills existing gateway process
2. Waits for clean shutdown
3. Starts gateway in background
4. Verifies gateway is responding
5. Shows status of all channels

## Implementation

```bash
#!/bin/bash

echo "🔄 Restarting OpenClaw Gateway..."
echo ""

# 1. Kill existing gateway
echo "Stopping gateway..."
pkill -9 -f openclaw-gateway
sleep 3

# 2. Start gateway in background
echo "Starting gateway..."
cd /Users/jensen/Documents/clawdbot
nohup pnpm openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &

# 3. Wait for startup
echo "Waiting for gateway to start..."
sleep 6

# 4. Check status
echo ""
echo "Gateway status:"
pnpm openclaw channels status 2>&1 | grep -E "(Gateway|Discord|Telegram)" | head -10

echo ""
echo "✅ Gateway restart complete"
echo ""
echo "📝 View logs: tail -f /tmp/openclaw-gateway.log"
```

## Error Handling

If gateway fails to start:

- Check logs: `tail -30 /tmp/openclaw-gateway.log`
- Verify config: `cat ~/.openclaw/openclaw.json | jq '.channels'`
- Run doctor: `pnpm openclaw doctor --fix`

## When to Use

- After changing Discord bot configuration
- After updating agent bindings
- After modifying channel allowlists
- After adding new Discord accounts
- When gateway becomes unresponsive

## Notes

- Gateway runs in background (nohup)
- Logs to `/tmp/openclaw-gateway.log`
- Process name: `openclaw-gateway`
- Port: 18789 (loopback only)
