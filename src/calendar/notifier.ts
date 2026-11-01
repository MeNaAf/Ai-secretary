import { createHmac } from "node:crypto";
import { claimDueNotifications, markNotificationFailed, markNotificationSent } from "./store.js";
import type { NotificationRecord } from "./types.js";

export function alertWebhookConfigured() {
  return Boolean(process.env.APEX_ALERT_WEBHOOK_URL?.trim());
}

export function signBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(note: NotificationRecord, url: string, fetchImpl: typeof fetch) {
  const body = JSON.stringify({ notification_id: note.id, attempt: note.attempts, ...note.payload });
  const headers: Record<string, string> = { "content-type": "application/json", "x-apex-notification-id": note.id };
  const secret = process.env.APEX_WEBHOOK_SECRET;
  if (secret) headers["x-apex-signature"] = signBody(body, secret);
  try {
    const response = await fetchImpl(url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Alert webhook responded with HTTP ${response.status}`);
    await markNotificationSent(note.id);
    return true;
  } catch (error) {
    // Never log or store the URL: n8n webhook paths are secrets.
    await markNotificationFailed(note.id, note.attempts, error instanceof Error ? error.message : "Delivery failed");
    return false;
  }
}

/**
 * Sends due notifications to n8n. At-least-once delivery: x-apex-notification-id is a stable
 * idempotency key the receiver can dedupe on. Failures retry with exponential backoff, then go "dead".
 */
export async function dispatchNotifications(limit = 10, fetchImpl: typeof fetch = fetch) {
  const url = process.env.APEX_ALERT_WEBHOOK_URL?.trim();
  if (!url) return { configured: false, sent: 0, failed: 0 };
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) return { configured: false, sent: 0, failed: 0 };
  const due = await claimDueNotifications(limit);
  const outcomes = await Promise.all(due.map((note) => deliver(note, url, fetchImpl)));
  const sent = outcomes.filter(Boolean).length;
  return { configured: true, sent, failed: outcomes.length - sent };
}
