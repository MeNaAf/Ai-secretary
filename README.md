# AI Secretary

AI-powered personal and SME operations assistant.

## Current foundation

- TypeScript + Node.js
- OpenRouter as the AI gateway
- Composio tool catalog for connected services
- Safe action planning with confirmation gates
- HTTP API for chat and planning
- GitHub Actions CI

## Connected-service capability map

The assistant is prepared for:

- Gmail — search, read threads, create drafts, send only after confirmation
- Google Calendar — list, check availability, create/update/delete with confirmation
- Google Drive — search and read files
- Google Sheets — read and write spreadsheet data with confirmation
- Notion — search and read knowledge
- Slack — search and read conversations
- HubSpot — search CRM records
- ClickUp — update tasks with confirmation

## API

### Health

`GET /health`

### Chat

`POST /api/chat`

```json
{
  "message": "Explain what I should focus on today."
}
```

### Secretary planner

`POST /api/plan`

```json
{
  "message": "Find my unread client emails and tell me which ones need attention."
}
```

The planner returns a tool-aware plan. External actions are not falsely reported as completed.

## Security model

Read-first, act-second.

The assistant should gather context with read-only tools first. High-impact mutations such as sending email, deleting events, changing business records, or writing important data require explicit confirmation.

## Secrets

Never commit a real API key.

For local development, create a local `.env` file from `.env.example`. For GitHub Actions and deployments, use encrypted environment secrets.
