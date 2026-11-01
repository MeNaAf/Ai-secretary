# AI Secretary

AI-powered personal and SME operations assistant.

## Production stack

- TypeScript + Node 20+
- Netlify Functions
- Netlify Database / Postgres for production persistence
- OpenRouter for the AI layer
- Composio for external integrations and tool calling
- PayPal Subscriptions for AI Secretary Pro
- GitHub Actions for CI

## Core

Authenticated accounts, OpenRouter tool calling, live Composio schemas, Gmail, Calendar, Drive, Sheets, Slack, Notion, HubSpot and ClickUp integrations, confirmation-gated mutations, conversation history, semantic memory, cross-source briefings, browser voice, and PayPal Pro subscriptions.

## PayPal Pro

AI Secretary Pro is $25 USD/month on plan `P-8SC10898FX170705XNK4PPNQ`.

Production webhook URL:

`https://aisecratory.netlify.app/api/paypal/webhook`

The production PayPal webhook ID is stored server-side as `PAYPAL_WEBHOOK_ID`. Webhook verification is performed against PayPal before subscription events are processed, and webhook event IDs are stored for idempotency.

Subscription flow:

1. User starts checkout and receives a short-lived checkout token.
2. PayPal creates the subscription with that token as `custom_id`.
3. The server verifies the subscription ID, plan ID and checkout token with PayPal.
4. The subscription is persisted in Postgres.
5. PayPal webhook events keep the local subscription status synchronized.

## Private beta

These three configured beta accounts receive Pro access without payment:

- `abduraghmaanltf23@gmail.com`
- `pregnantassistant@gmail.com`
- `abdulmenaafpeters2022@gmail.com`

Beta access is controlled server-side and does not bypass authentication.

## Production environment

Required production configuration includes:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `COMPOSIO_API_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_PLAN_ID`
- `PAYPAL_WEBHOOK_ID`
- `AI_SECRETARY_BETA_EMAILS`
- `APP_ORIGIN=https://aisecratory.netlify.app`
- `AI_SECRETARY_ALLOW_DEV_IDENTITY=false`

Secrets must be stored in Netlify environment variables, never committed to Git.

## Calendar monitor (Apex MI)

A notification engine for **licensed** economic-calendar data. It does not scrape Forex Factory or any other site, and ships with no live data connection: you must connect a provider whose licence permits your use and any redistribution.

Flow: provider/automation `POST /api/calendar/webhook` (HMAC-signed) → normalise → store in Postgres → detect new/changed events → queue one alert per distinct event state → deliver to n8n (`APEX_ALERT_WEBHOOK_URL`) with retries.

- **Auth:** `x-apex-signature` = hex HMAC-SHA256 of the raw body using `APEX_WEBHOOK_SECRET`. Unsigned/invalid requests get 401. Recommended: also send `x-apex-timestamp` (unix seconds) and sign `"<timestamp>.<body>"`; requests more than 5 minutes off are rejected, which blocks replay. Set `APEX_REQUIRE_TIMESTAMP=true` to make this mandatory.
- **Payload:** `{ "source": "my-provider", "events": [{ "event_id", "event_name", "country", "currency", "impact", "event_time", "forecast", "previous", "actual", "source_url" }] }`. A single event object is also accepted. Use `registerAdapter(source, adapter)` in `src/calendar/adapters.ts` to translate a provider's native format.
- **No duplicate alerts:** the alert queue is unique on (event, content fingerprint) and change detection runs in a row-locked transaction, so concurrent identical updates produce one alert.
- **Delivery:** at-least-once. Each alert carries a stable `x-apex-notification-id` (dedupe on this in n8n) and is signed with the same secret. Failures back off exponentially (30s, 60s, ... up to 1h) and become `dead` after 5 attempts. Retry from the dashboard, or have n8n schedule `POST /api/calendar/dispatch` (signed, empty `{}` body) to drain the queue.
- **Demo data:** sources starting with `demo` (or payloads with `"demo": true`) are stored with `is_demo`, shown as DEMO in the dashboard and sent with `data_status: "demo"`.
- **Dashboard:** `/admin.html`, available to signed-in users listed in `AI_SECRETARY_ADMIN_EMAILS`. Shows latest events, new/updated alerts, last successful update, provider status and failed notifications.
- **Database:** `netlify/database/migrations/002_market_events/migration.sql` (plain Postgres, not Supabase).
- **Test:** `APEX_WEBHOOK_SECRET=... node scripts/test-calendar-webhook.mjs http://localhost:3000` expects new, unchanged, updated, then 401.

n8n workflow: Webhook trigger → Switch on `type` (`new_event` / `event_updated`) → AI step to explain the event in plain language (use `data_status` to label demo data) → send via WhatsApp/email/Telegram.

## Storage

Production application data is persisted in Netlify Database/Postgres, including users, sessions, conversations, messages, activity, memories, confirmations, subscriptions, checkout tokens and PayPal webhook event IDs.

Local development falls back to local JSON/in-memory stores when Netlify Database is unavailable.

## Security

- Passwords use scrypt hashing with per-user salts.
- Browser sessions use random tokens; production database stores only the derived session key.
- Session cookies are HttpOnly and SameSite=Lax and are Secure in production.
- Mutating production requests enforce same-origin checks.
- Authentication has an in-memory rate limit.
- Request bodies are capped at 1 MB.
- Server-side secrets are never sent to the browser.
- Tool mutations require explicit confirmation.
- PayPal webhook signatures are verified before processing.
- Duplicate PayPal webhook event IDs are ignored.

## Development

```bash
npm install
npm test
npm run build
npm start
```

Local `x-user-id` development identity is available only when `AI_SECRETARY_ALLOW_DEV_IDENTITY=true` and must remain false in production.

## Routes

Public: `/`, `/health`, `/api/auth/*`, `/api/paypal/webhook`.

Authenticated: `/api/subscription*`.

Pro: `/api/chat`, `/api/confirm`, `/api/briefing`, `/api/connections`, `/api/conversations/*`, `/api/memories*`, `/api/activity`, `/api/tools` and `/api/plan`.

## Explicitly excluded from MVP

Zoom, Microsoft Teams, WhatsApp Business, paid SMS/voice and other paid infrastructure beyond the existing PayPal Pro subscription.

## Production

Live site: https://aisecratory.netlify.app
Repository: https://github.com/MeNaAf/Ai-secretary
