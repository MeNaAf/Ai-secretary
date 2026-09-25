# AI Secretary

AI-powered personal and SME operations assistant.

## Runtime

User → AI Secretary → OpenRouter tool calling → Composio user session → connected apps.

The agent now passes structured parameter schemas to OpenRouter instead of exposing tools as empty objects. This reduces malformed tool calls and makes the assistant aware of required IDs and fields.

Read-only actions can execute automatically. Actions that change external data require confirmation.

## Environment

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
COMPOSIO_API_KEY=
PORT=3000

Never commit API keys or .env.

## API

POST /api/chat

{
  "userId": "user_123",
  "message": "What do I have today?",
  "sessionId": "optional-existing-session"
}

POST /api/plan

POST /api/tool/execute

## Next layers

1. Real authentication and database-backed users
2. Connection-management UI
3. Exact schema validation against every live Composio action
4. Per-user memory and audit logs
5. Daily briefings and scheduled workflows
6. Voice interface
