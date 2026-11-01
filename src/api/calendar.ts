import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAdmin } from "../admin.js";
import { PayloadError, parsePayload } from "../calendar/adapters.js";
import { alertWebhookConfigured, dispatchNotifications, signBody } from "../calendar/notifier.js";
import { calendarSummary, ingestEvents, recordProviderFailure, recordProviderReceive, requeueNotification } from "../calendar/store.js";

type ReadBody = (req: IncomingMessage) => Promise<string>;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Without a timestamp the signature covers the raw body. With `x-apex-timestamp` (unix seconds or ms)
 * it covers `${timestamp}.${body}` and must be fresh, which stops replay of captured requests.
 * APEX_REQUIRE_TIMESTAMP=true rejects requests that omit it.
 */
export function validSignature(raw: string, header: string | string[] | undefined, secret: string | undefined, timestamp?: string | string[], now = Date.now()) {
  if (!secret || typeof header !== "string") return false;
  const supplied = header.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(supplied)) return false;
  let signed = raw;
  if (typeof timestamp === "string" && timestamp !== "") {
    if (!/^\d{10,13}$/.test(timestamp)) return false;
    const ms = timestamp.length <= 10 ? Number(timestamp) * 1000 : Number(timestamp);
    if (Math.abs(now - ms) > TIMESTAMP_TOLERANCE_MS) return false;
    signed = `${timestamp}.${raw}`;
  } else if (process.env.APEX_REQUIRE_TIMESTAMP === "true") {
    return false;
  }
  return timingSafeEqual(Buffer.from(supplied.toLowerCase(), "hex"), Buffer.from(signBody(signed, secret), "hex"));
}

/** Public (HMAC-authenticated) routes: POST /api/calendar/webhook and POST /api/calendar/dispatch. */
export async function calendarWebhookResponse(req: IncomingMessage, res: ServerResponse, readBody: ReadBody) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (req.method !== "POST" || (path !== "/api/calendar/webhook" && path !== "/api/calendar/dispatch")) return false;
  const secret = process.env.APEX_WEBHOOK_SECRET;
  if (!secret) return send(res, 503, { error: "APEX_WEBHOOK_SECRET is not configured." }), true;
  const raw = await readBody(req);
  if (!validSignature(raw, req.headers["x-apex-signature"], secret, req.headers["x-apex-timestamp"])) return send(res, 401, { error: "Invalid signature." }), true;

  // Lets n8n (or any scheduler) drain the retry queue.
  if (path === "/api/calendar/dispatch") return send(res, 200, { ok: true, ...(await dispatchNotifications(20)) }), true;

  let source = "unknown";
  try {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new PayloadError("Body must be valid JSON."); }
    if (json && typeof json === "object" && typeof (json as any).source === "string") source = String((json as any).source).trim().toLowerCase().slice(0, 64) || source;
    const parsed = parsePayload(json);
    source = parsed.source;
    const results = await ingestEvents(parsed.source, parsed.demo, parsed.events);
    await recordProviderReceive(parsed.source, parsed.demo, parsed.events.length);
    const delivery = await dispatchNotifications(10).catch(() => ({ configured: alertWebhookConfigured(), sent: 0, failed: 0 }));
    return send(res, 200, { success: true, processed: results.length, results, notifications: delivery }), true;
  } catch (error) {
    if (error instanceof PayloadError) {
      await recordProviderFailure(source, error.message).catch(() => undefined);
      return send(res, 400, { error: error.message }), true;
    }
    console.error("Calendar webhook error:", error instanceof Error ? error.message : error);
    await recordProviderFailure(source, "Internal processing error").catch(() => undefined);
    return send(res, 500, { error: "Calendar processing failed." }), true;
  }
}

/** Admin routes (session auth + AI_SECRETARY_ADMIN_EMAILS). */
export async function calendarAdminResponse(req: IncomingMessage, res: ServerResponse, email: string | undefined, readBody: ReadBody) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!path.startsWith("/api/admin/calendar")) return false;
  if (!isAdmin(email)) return send(res, 403, { error: "Admin access required." }), true;
  if (req.method === "GET" && path === "/api/admin/calendar") {
    const summary = await calendarSummary();
    const url = process.env.APEX_ALERT_WEBHOOK_URL?.trim();
    return send(res, 200, {
      ...summary,
      config: { webhookSecretConfigured: Boolean(process.env.APEX_WEBHOOK_SECRET), alertWebhookConfigured: alertWebhookConfigured(), alertWebhookInsecure: Boolean(url && !url.startsWith("https://")) },
    }), true;
  }
  if (req.method === "POST" && path === "/api/admin/calendar/retry") {
    let body: any = {};
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch { return send(res, 400, { error: "Invalid JSON." }), true; }
    if (typeof body.id !== "string") return send(res, 400, { error: "id is required." }), true;
    const requeued = await requeueNotification(body.id);
    if (!requeued) return send(res, 404, { error: "No failed notification with that id." }), true;
    return send(res, 200, { ok: true, ...(await dispatchNotifications(10)) }), true;
  }
  return send(res, 404, { error: "Not found" }), true;
}
