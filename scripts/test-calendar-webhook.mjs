// Usage: APEX_WEBHOOK_SECRET=... node scripts/test-calendar-webhook.mjs [baseUrl]
// Sends SIMULATED events (source "demo-provider"); the app flags them as DEMO, never live.
import { createHmac } from "node:crypto";

const secret = process.env.APEX_WEBHOOK_SECRET;
if (!secret) {
  console.error("Set APEX_WEBHOOK_SECRET (same value the server uses).");
  process.exit(1);
}
const base = process.argv[2] ?? "http://localhost:3000";

async function send(label, payload) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const res = await fetch(`${base}/api/calendar/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-apex-signature": signature, "x-apex-timestamp": timestamp }, body });
  console.log(`${label}: HTTP ${res.status}`, JSON.stringify(await res.json()));
}

const event = { event_id: "US-CPI-001", event_name: "US Consumer Price Index", country: "United States", currency: "USD", impact: "High", event_time: "2026-11-15T13:30:00Z", forecast: "3.1%", previous: "3.2%" };
await send("1. new event (expect new)", { source: "demo-provider", demo: true, events: [event] });
await send("2. identical resend (expect unchanged)", { source: "demo-provider", demo: true, events: [event] });
await send("3. actual released (expect updated)", { source: "demo-provider", demo: true, events: [{ ...event, actual: "3.4%" }] });

const bad = JSON.stringify({ events: [event] });
const res = await fetch(`${base}/api/calendar/webhook`, { method: "POST", headers: { "x-apex-signature": "0".repeat(64) }, body: bad });
console.log(`4. bad signature (expect 401): HTTP ${res.status}`);
