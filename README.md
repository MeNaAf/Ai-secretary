# AI Secretary

AI-powered personal and SME operations assistant.

## Current architecture

User → API → OpenRouter → tool calling → Composio → connected apps.

### Current foundation

- Structured OpenRouter tool calling
- Composio-backed connected-app execution
- Read-only automatic actions
- Confirmation gate for mutations
- User profile foundation
- Assistant activity/audit foundation
- Dashboard API endpoints

## Development endpoints

- GET /health
- GET /api/me
- GET /api/activity
- GET /api/tools
- POST /api/chat
- POST /api/plan
- POST /api/tool/execute

For local development, user identity can be supplied with the `x-user-id` header. This is NOT production authentication.

## Environment

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
COMPOSIO_API_KEY=
PORT=3000

Never commit API keys or .env.

## Next layers

1. Persistent database
2. Real authentication
3. Connection-management UI
4. Exact live schema validation for every Composio action
5. Memory and conversation persistence
6. Dashboard frontend
7. Daily briefings and scheduled workflows
8. Voice interface
