# AI Secretary

AI-powered personal and SME operations assistant.

## Architecture

User -> AI Secretary API -> OpenRouter (reasoning) -> Composio (connected tools) -> Gmail / Calendar / Drive / Sheets / Notion / Slack / HubSpot / ClickUp

The application uses Composio's TypeScript SDK for server-side tool execution. Composio keeps provider credentials server-side and executes tools using the connected account selected for the user.

## Current capabilities

- OpenRouter AI chat
- Secretary planning layer
- Composio tool catalog
- Server-side Composio tool executor
- Read-first safety model
- Explicit confirmation required for high-impact actions
- GitHub Actions CI

## API

### Health

GET `/health`

### Chat

POST `/api/chat`

```json
{
  "message": "Help me prioritize today."
}
```

### Plan

POST `/api/plan`

```json
{
  "message": "Find the emails that need my attention."
}
```

### Execute a known Composio tool

POST `/api/tool/execute`

```json
{
  "toolSlug": "GMAIL_GET_PROFILE",
  "userId": "your-app-user-id",
  "arguments": {}
}
```

For a mutating tool, the request must additionally contain `"confirmed": true`.

## Environment variables

```text
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
COMPOSIO_API_KEY=
PORT=3000
```

Never commit real secrets. Store them in GitHub/hosting encrypted secrets.

## Important

The Composio `userId` is the application user's identity in your Composio project. It should be stable per user. Connected accounts are selected by Composio for that user, or by explicit connected account ID when multiple accounts exist.

The next application layer should add authentication and a database so each SME/personal user gets an isolated userId and their own connected accounts.
