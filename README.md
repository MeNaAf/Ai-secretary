# AI Secretary

AI-powered personal and SME operations assistant.

## MVP foundation

- TypeScript + Node.js
- OpenRouter as the AI model gateway
- Secure environment variables
- HTTP API with health and chat endpoints
- Designed to connect to Gmail, Calendar, Drive, Sheets, Notion, Slack, HubSpot, ClickUp and other tools through Composio

## Project structure

```
src/
  ai/
    openrouter.ts
  config.ts
  index.ts
  types.ts
.env.example
.gitignore
package.json
tsconfig.json
.github/workflows/ci.yml
```

## Run locally

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

4. Put your OpenRouter key in your local `.env` file. Never commit it.

5. Start development:

```bash
npm run dev
```

The API starts on port 3000 by default.

## API

### Health

`GET /health`

### Chat

`POST /api/chat`

Body:

```json
{
  "message": "What should I focus on today?"
}
```

The production assistant will later add authenticated user context and Composio actions before taking external actions.

## Security

- Real API keys belong in GitHub Secrets or the hosting provider's encrypted environment variables.
- Local secrets belong in `.env`, which is gitignored.
- Never paste API keys into source code, README files, issues, or chat.
