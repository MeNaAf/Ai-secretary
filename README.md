# AI Secretary

AI-powered personal and SME operations assistant.

## Runtime architecture

```
User
 ↓
AI Secretary API
 ↓
OpenRouter
 ↓
Tool-calling agent loop
 ↓
Composio user session
 ↓
Gmail / Calendar / Drive / Sheets / Notion / Slack / HubSpot / ClickUp
```

The agent can now decide when to use a connected read-only tool, execute it through the user's Composio session, feed the result back to the model, and continue until it can answer.

Mutating tools remain behind a confirmation gate.

## Environment

```
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
COMPOSIO_API_KEY=
PORT=3000
```

Never commit API keys or `.env`.

## API

`POST /api/chat`

```json
{
  "userId": "user_123",
  "message": "What do I have today?",
  "sessionId": "optional-existing-session"
}
```

The response includes a `sessionId` that the frontend should persist for the user.

`POST /api/plan` remains available for explicit planning.

`POST /api/tool/execute` remains available for controlled direct execution.

## Build

```bash
npm install
npm run build
```

## Next layers

1. Real authentication and database-backed users
2. Connection-management UI
3. Exact Composio tool schemas for model function parameters
4. Per-user memory and audit logs
5. Daily briefings and scheduled workflows
6. Voice interface
