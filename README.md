# AI Secretary

AI-powered personal and SME operations assistant.

## Architecture

User → AI Secretary UI/API → OpenRouter → tool calling → Composio → connected apps.

## Current foundation

- OpenRouter tool-calling agent
- Composio-backed connected-app execution
- Read-only automatic actions
- Confirmation gate for mutations
- User profile and activity foundation
- Conversation and confirmation foundation
- Browser dashboard with chat, activity and connections views
- GitHub Actions TypeScript build

## Development endpoints

GET / — dashboard
GET /health
GET /api/me
GET /api/activity
GET /api/tools
GET /api/conversations/:id/messages
POST /api/chat
POST /api/confirm
POST /api/plan
POST /api/tool/execute

Local development can use the x-user-id header. This is NOT production authentication.

## Environment

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
COMPOSIO_API_KEY=
PORT=3000

Never commit API keys or .env.

## Next layers

1. Exact live Composio schema validation
2. Persistent database
3. Real authentication
4. Connection-management UI
5. Durable conversation and memory storage
6. Daily briefings and scheduled workflows
7. Voice interface
8. Production deployment
