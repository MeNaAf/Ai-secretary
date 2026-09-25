# AI Secretary

AI Secretary is an AI-powered personal and SME operations assistant.

## Architecture

```
User
  ↓
AI Secretary API
  ↓
OpenRouter
  ↓
Composio Session (scoped to the application user)
  ↓
Gmail / Calendar / Drive / Sheets / Notion / Slack / HubSpot / ClickUp
```

## Current foundation

- TypeScript + Node.js
- OpenRouter as the model gateway
- Composio for connected-app authentication and tool execution
- Session-scoped Composio execution so connected accounts are isolated by `userId`
- Confirmation gates for mutating actions
- GitHub Actions CI

Composio sessions are the runtime boundary for a user's connected accounts and tool access. The application should use a stable database-backed user ID in production and persist the Composio session ID for reuse. citeturn0search8turn0search9

## Environment

Copy `.env.example` to `.env` for local development:

```
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
COMPOSIO_API_KEY=
PORT=3000
```

Never commit `.env` or API keys.

## Run

```bash
npm install
npm run build
npm run dev
```

## API

### Health

`GET /health`

### Chat

`POST /api/chat`

```json
{
  "userId": "user_123",
  "message": "What do I have today?"
}
```

### Planning

`POST /api/plan`

### Tool execution

`POST /api/tool/execute`

Mutating tools require:

```json
{
  "confirmed": true
}
```

A successful execution returns a `sessionId`. Send that ID on later tool calls when reusing the same Composio session.

## Next build layer

1. Real user authentication
2. Persistent database user IDs and session IDs
3. Connection-management UI
4. OpenRouter tool-calling loop
5. Per-user memory and audit log
6. Daily briefing and scheduled workflows
