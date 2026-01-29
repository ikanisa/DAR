# Moltbot Configuration — Dar Real Estate

This directory contains the Moltbot gateway configuration and agent prompt files for the Dar Malta Real Estate platform.

## Directory Structure

```
infra/moltbot/
├── moltbot.json          # Gateway configuration
├── agents/
│   ├── poster/AGENTS.md  # Listing creation agent (WhatsApp)
│   ├── seeker/AGENTS.md  # Property search agent (Telegram)
│   └── admin/AGENTS.md   # Review/moderation agent (WebChat)
└── README.md             # This file
```

## Quick Start

### 1. Prerequisites
- Moltbot installed: `pnpm moltbot onboard --install-daemon`
- Backend running at `http://localhost:3001`

### 2. Environment Variables
Create `.env` in this directory:
```bash
MOLTBOT_GATEWAY_TOKEN=your-secure-gateway-token
MOLTBOT_WEBHOOK_TOKEN=your-secure-webhook-token
DAR_BACKEND_URL=http://localhost:3001
SERVICE_TOKEN=your-backend-service-token
WHATSAPP_API_TOKEN=your-meta-whatsapp-token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 3. Start Gateway
```bash
cd infra/moltbot
pnpm moltbot gateway start --config ./moltbot.json
```

### 4. Verify Status
```bash
pnpm moltbot gateway status
```

## Agent Bindings

| Channel   | Agent          | Purpose                    |
|-----------|----------------|----------------------------|
| WhatsApp  | poster-agent   | Listing creation workflow  |
| Telegram  | seeker-agent   | Property search & viewings |
| WebChat   | admin-agent    | Review queue & moderation  |

## Security Features

### Pairing (DM Security)
- WhatsApp and Telegram DMs require pairing approval
- Pairing codes expire after 10 minutes
- Users must confirm identity before full access

### Rate Limiting
- 20 messages per minute per user
- 200 messages per hour per user

### Token Authentication
- Gateway control plane requires token
- All tool calls use service token
- Webhook endpoints authenticated

## How Pairing Works

1. User sends first DM to bot
2. Bot responds: "Pairing required. Enter code: XXXX"
3. User enters code within 10 minutes
4. Session established, full functionality enabled

To approve a pairing manually:
```bash
pnpm moltbot pairing list
pnpm moltbot pairing approve <pairing-id>
```

## Token Rotation

### Gateway Token
```bash
# Generate new token
NEW_TOKEN=$(openssl rand -hex 32)

# Update moltbot.json and .env
# Restart gateway
pnpm moltbot gateway restart --config ./moltbot.json
```

### Service Token
Also update in backend `.env` and restart both services.

## Tool Endpoints

All tools are proxied through the backend API:

| Tool              | Backend Endpoint                    |
|-------------------|-------------------------------------|
| listing.validate  | POST /api/tools/listing/validate    |
| listing.dedupe    | POST /api/tools/listing/dedupe      |
| listing.search    | GET /api/listings/search            |
| viewing.schedule  | POST /api/viewings                  |
| admin.queue       | GET /api/tools/admin/review-queue   |
| admin.decision    | POST /api/tools/admin/decision      |
| notify.whatsapp   | POST /api/notifications/whatsapp    |
| notify.telegram   | POST /api/notifications/telegram    |

## Troubleshooting

### Gateway won't start
```bash
# Check port availability
lsof -i :18789

# Check config syntax
pnpm moltbot config validate ./moltbot.json
```

### Agent not responding
```bash
# Check agent logs
pnpm moltbot logs --agent poster-agent

# Verify bindings
pnpm moltbot bindings list
```

### Tool calls failing
```bash
# Test backend connectivity
curl http://localhost:3001/health

# Check service token
curl -H "Authorization: Bearer service:$SERVICE_TOKEN" \
  http://localhost:3001/api/tools/admin/review-queue
```

## Production Notes

1. **Never expose gateway externally** — Use Tailscale or reverse proxy
2. **Rotate tokens regularly** — Monthly minimum
3. **Monitor metrics** — Set up alerts for failures
4. **Backup config** — Version control all config files
