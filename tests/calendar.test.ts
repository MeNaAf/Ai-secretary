import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
delete process.env.DATABASE_URL;
delete process.env.NETLIFY_DB_URL;
process.env.APEX_WEBHOOK_SECRET = "test-secret";
process.env.APEX_ALERT_WEBHOOK_URL = "https://n8n.example.test/webhook/abc";

const { parsePayload, PayloadError, fingerprintEvent } = await import("../src/calendar/adapters.js");
const store = await import("../src/calendar/store.js");
const { dispatchNotifications } = await import("../src/calendar/notifier.js");
const { validSignature } = await import("../src/api/calendar.js");

const base = { event_id: "E1", event_name: "US CPI", currency: "USD", impact: "High", event_time: "2026-11-15T13:30:00Z", forecast: "3.1%", previous: "3.2%" };
const ingest = async (extra: object = {}, source = "demo-provider") => {
  const parsed = parsePayload({ source, events: [{ ...base, ...extra }] });
  return store.ingestEvents(parsed.source, parsed.demo, parsed.events);
};
const ok = async () => new Response("ok", { status: 200 });
const fail = async () => new Response("no", { status: 500 });

test.beforeEach(() => store.resetCalendarMemory());

test("signature check accepts correct HMAC and rejects bad, missing and malformed", () => {
  const raw = '{"a":1}';
  const good = createHmac("sha256", "test-secret").update(raw).digest("hex");
  assert.equal(validSignature(raw, good, "test-secret"), true);
  assert.equal(validSignature(raw, "sha256=" + good, "test-secret"), true);
  assert.equal(validSignature(raw, "0".repeat(64), "test-secret"), false);
  assert.equal(validSignature(raw, "zz", "test-secret"), false);
  assert.equal(validSignature(raw, undefined, "test-secret"), false);
  assert.equal(validSignature(raw, good, undefined), false);
});

test("timestamped signatures: fresh accepted, stale/tampered/unsigned-timestamp rejected, required mode enforced", () => {
  const raw = '{"a":1}';
  const now = Date.now();
  const ts = String(Math.floor(now / 1000));
  const sig = (t: string) => createHmac("sha256", "test-secret").update(`${t}.${raw}`).digest("hex");
  assert.equal(validSignature(raw, sig(ts), "test-secret", ts, now), true);
  const stale = String(Math.floor(now / 1000) - 600);
  assert.equal(validSignature(raw, sig(stale), "test-secret", stale, now), false);
  assert.equal(validSignature(raw, sig(ts), "test-secret", String(Number(ts) + 1), now), false);
  const bodyOnly = createHmac("sha256", "test-secret").update(raw).digest("hex");
  assert.equal(validSignature(raw, bodyOnly, "test-secret", ts, now), false);
  process.env.APEX_REQUIRE_TIMESTAMP = "true";
  assert.equal(validSignature(raw, bodyOnly, "test-secret", undefined, now), false);
  assert.equal(validSignature(raw, sig(ts), "test-secret", ts, now), true);
  delete process.env.APEX_REQUIRE_TIMESTAMP;
});

test("new, unchanged and updated events are detected", async () => {
  assert.equal((await ingest())[0].status, "new");
  assert.equal((await ingest())[0].status, "unchanged");
  assert.equal((await ingest({ actual: "3.4%" }))[0].status, "updated");
});

test("one notification per distinct state; duplicates never re-queue", async () => {
  await ingest(); await ingest(); await ingest({ actual: "3.4%" }); await ingest({ actual: "3.4%" });
  const summary = await store.calendarSummary();
  assert.equal(summary.recentChanges.length, 2);
  const updated = summary.recentChanges.find((n) => n.changeType === "event_updated")!;
  assert.deepEqual(updated.payload.changes, { actual: { from: null, to: "3.4%" } });
});

test("concurrent identical updates produce a single alert", async () => {
  await ingest();
  await Promise.all([ingest({ actual: "3.4%" }), ingest({ actual: "3.4%" })]);
  assert.equal((await store.calendarSummary()).recentChanges.filter((n) => n.changeType === "event_updated").length, 1);
});

test("demo data is flagged and never labelled live", async () => {
  await ingest();
  const [note] = (await store.calendarSummary()).recentChanges;
  assert.equal(note.payload.data_status, "demo");
  await ingest({ event_id: "E2" }, "licensed-x");
  const live = (await store.calendarSummary()).recentChanges.find((n) => n.payload.source === "licensed-x")!;
  assert.equal(live.payload.data_status, "live");
});

test("successful dispatch sends once, signed, with an idempotency header", async () => {
  await ingest();
  let calls = 0; let headers: Headers | undefined;
  const fetchImpl = (async (_u: string, init: RequestInit) => { calls++; headers = new Headers(init.headers); return new Response("ok"); }) as unknown as typeof fetch;
  assert.deepEqual(await dispatchNotifications(10, fetchImpl), { configured: true, sent: 1, failed: 0 });
  assert.deepEqual(await dispatchNotifications(10, fetchImpl), { configured: true, sent: 0, failed: 0 });
  assert.equal(calls, 1);
  assert.ok(headers!.get("x-apex-notification-id"));
  assert.match(headers!.get("x-apex-signature")!, /^[0-9a-f]{64}$/);
});

test("failed delivery is recorded, backed off, then retried via requeue", async () => {
  await ingest();
  assert.equal((await dispatchNotifications(10, fail as unknown as typeof fetch)).failed, 1);
  let summary = await store.calendarSummary();
  assert.equal(summary.failedNotifications.length, 1);
  assert.match(summary.failedNotifications[0].lastError!, /HTTP 500/);
  // Backoff: not due immediately.
  assert.equal((await dispatchNotifications(10, ok as unknown as typeof fetch)).sent, 0);
  assert.equal(await store.requeueNotification(summary.failedNotifications[0].id), true);
  assert.equal((await dispatchNotifications(10, ok as unknown as typeof fetch)).sent, 1);
  summary = await store.calendarSummary();
  assert.equal(summary.failedNotifications.length, 0);
});

test("notification goes dead after max attempts", async () => {
  await ingest();
  const id = (await store.calendarSummary()).recentChanges[0].id;
  for (let i = 0; i < store.MAX_ATTEMPTS; i++) {
    await store.requeueNotification(id);
    const [note] = await store.claimDueNotifications(1);
    if (i === 0) assert.ok(note);
  }
  await store.markNotificationFailed(id, store.MAX_ATTEMPTS, "boom");
  assert.equal((await store.calendarSummary()).failedNotifications[0].status, "dead");
});

test("payload validation rejects bad input", () => {
  assert.throws(() => parsePayload({ events: [{ event_name: "x" }] }), PayloadError);
  assert.throws(() => parsePayload({ events: [] }), PayloadError);
  assert.throws(() => parsePayload({ source: "Bad Source!", events: [base] }), PayloadError);
  assert.throws(() => parsePayload({ events: [{ ...base, event_time: "not a date" }] }), PayloadError);
  assert.throws(() => parsePayload("string"), PayloadError);
});

test("fingerprint ignores nothing it tracks and is stable", () => {
  const e = parsePayload({ events: [base] }).events[0];
  assert.equal(fingerprintEvent(e), fingerprintEvent({ ...e }));
  assert.notEqual(fingerprintEvent(e), fingerprintEvent({ ...e, actual: "1" }));
});
