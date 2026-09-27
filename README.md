# AI Secretary

AI-powered personal and SME operations assistant.

## Core

Authenticated accounts, OpenRouter tool calling, live Composio schemas, Gmail, Calendar, Drive, Sheets, Slack, Notion, HubSpot and ClickUp integrations, confirmation-gated mutations, conversation history, semantic memory, cross-source briefings, browser voice, and PayPal Pro subscriptions.

## PayPal Pro

AI Secretary Pro is $25 USD/month on the existing active plan P-8SC10898FX170705XNK4PPNQ. The server obtains PayPal OAuth access tokens, verifies the returned subscription ID against the configured plan and checkout token, persists subscription state, supports cancellation, and verifies PayPal webhooks.

Required variables: OPENROUTER_API_KEY, OPENROUTER_MODEL, COMPOSIO_API_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID, PAYPAL_WEBHOOK_ID, PAYPAL_BASE_URL, APP_ORIGIN, PORT, AI_SECRETARY_ALLOW_DEV_IDENTITY, AI_SECRETARY_DATA_DIR.

Set PAYPAL_WEBHOOK_ID after creating the webhook in PayPal. Production webhook URL: POST https://YOUR-DOMAIN/api/paypal/webhook. Subscribe to BILLING.SUBSCRIPTION.CREATED, ACTIVATED, UPDATED, SUSPENDED, CANCELLED, EXPIRED and PAYMENT.FAILED events.

The PayPal client ID is safe for browser SDK initialization; the client secret is server-only. Never commit .env or credentials.

## Storage

The current zero-infrastructure persistence layer is local JSON under AI_SECRETARY_DATA_DIR. The billing layer is isolated so it can be replaced by Supabase/Postgres without changing the product routes. Multi-instance production should use a shared database before horizontal scaling.

## Development

npm install
npm test
npm run build
npm start

Local x-user-id development identity is available only when AI_SECRETARY_ALLOW_DEV_IDENTITY=true and must remain false in production.

## Explicitly excluded

Zoom, Microsoft Teams, WhatsApp Business, paid SMS/voice and other paid infrastructure beyond the existing PayPal Pro subscription.

## Routes

Public: /, /health, /api/auth/*, /api/paypal/webhook.
Authenticated: /api/subscription*.
Pro: /api/chat, /api/confirm, /api/briefing, /api/connections, /api/conversations/*, /api/memories*, /api/activity, /api/tools and /api/plan.
