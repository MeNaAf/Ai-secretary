import { randomUUID } from "node:crypto";
import { db, query } from "../db.js";
import { diffEvents, fingerprintEvent } from "./adapters.js";
import type { IngestResult, NormalisedEvent, NotificationPayload, NotificationRecord, ProviderStatus, StoredEvent } from "./types.js";

export const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 120;

const memEvents = new Map<string, StoredEvent>(); // key: source|eventId
const memNotifications = new Map<string, NotificationRecord>();
const memProviders = new Map<string, ProviderStatus>();

export function resetCalendarMemory() {
  memEvents.clear();
  memNotifications.clear();
  memProviders.clear();
}

export function backoffSeconds(attempts: number) {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
}

const EVENT_COLUMNS = `id,source,source_event_id AS "eventId",event_name AS name,country,currency,impact,event_time AS "eventTime",forecast,previous,actual,source_url AS "sourceUrl",fingerprint,is_demo AS "isDemo",first_seen_at AS "firstSeenAt",updated_at AS "updatedAt"`;
const NOTE_COLUMNS = `id,market_event_id AS "marketEventId",fingerprint,change_type AS "changeType",payload,status,attempts,next_attempt_at AS "nextAttemptAt",last_error AS "lastError",created_at AS "createdAt",sent_at AS "sentAt"`;

function iso(value: unknown): string | null {
  return value ? new Date(value as string | Date).toISOString() : null;
}
function normaliseEventRow(row: any): StoredEvent {
  return { ...row, eventTime: iso(row.eventTime), firstSeenAt: iso(row.firstSeenAt)!, updatedAt: iso(row.updatedAt)! };
}
function normaliseNoteRow(row: any): NotificationRecord {
  return { ...row, nextAttemptAt: iso(row.nextAttemptAt)!, createdAt: iso(row.createdAt)!, sentAt: iso(row.sentAt) };
}
function toEvent(row: StoredEvent): NormalisedEvent {
  const { eventId, name, country, currency, impact, eventTime, forecast, previous, actual, sourceUrl } = row;
  return { eventId, name, country, currency, impact, eventTime, forecast, previous, actual, sourceUrl };
}

function buildPayload(type: "new_event" | "event_updated", source: string, demo: boolean, event: NormalisedEvent, before?: NormalisedEvent): NotificationPayload {
  return {
    type,
    source,
    data_status: demo ? "demo" : "live",
    detected_at: new Date().toISOString(),
    event,
    changes: before ? diffEvents(before, event) : {},
  };
}

/**
 * Stores events and queues exactly one notification per distinct event state.
 * Postgres path: one transaction, row lock on the existing event, UNIQUE (event, fingerprint) on the outbox,
 * so concurrent deliveries of the same update cannot create duplicate alerts.
 */
export async function ingestEvents(source: string, demo: boolean, events: NormalisedEvent[]): Promise<IngestResult[]> {
  return db ? ingestPg(source, demo, events) : ingestMemory(source, demo, events);
}

async function ingestPg(source: string, demo: boolean, events: NormalisedEvent[]): Promise<IngestResult[]> {
  const client = await db!.connect();
  const results: IngestResult[] = [];
  try {
    await client.query("BEGIN");
    for (const event of events) {
      const fingerprint = fingerprintEvent(event);
      const values = [event.name, event.country, event.currency, event.impact, event.eventTime, event.forecast, event.previous, event.actual, event.sourceUrl, fingerprint, demo];
      const inserted = await client.query(
        `INSERT INTO market_events (id,source,source_event_id,event_name,country,currency,impact,event_time,forecast,previous,actual,source_url,fingerprint,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (source,source_event_id) DO NOTHING RETURNING id`,
        [randomUUID(), source, event.eventId, ...values],
      );
      let rowId: string;
      let type: "new_event" | "event_updated";
      let before: NormalisedEvent | undefined;
      if (inserted.rows[0]) {
        rowId = inserted.rows[0].id;
        type = "new_event";
      } else {
        const existing = await client.query(`SELECT ${EVENT_COLUMNS} FROM market_events WHERE source=$1 AND source_event_id=$2 FOR UPDATE`, [source, event.eventId]);
        const current = normaliseEventRow(existing.rows[0]);
        if (current.fingerprint === fingerprint) {
          results.push({ id: event.eventId, status: "unchanged" });
          continue;
        }
        before = toEvent(current);
        rowId = current.id;
        type = "event_updated";
        await client.query(
          `UPDATE market_events SET event_name=$1,country=$2,currency=$3,impact=$4,event_time=$5,forecast=$6,previous=$7,actual=$8,source_url=$9,fingerprint=$10,is_demo=$11,updated_at=NOW() WHERE id=$12`,
          [...values, rowId],
        );
      }
      await client.query(
        `INSERT INTO market_event_notifications (id,market_event_id,fingerprint,change_type,payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (market_event_id,fingerprint) DO NOTHING`,
        [randomUUID(), rowId, fingerprint, type, JSON.stringify(buildPayload(type, source, demo, event, before))],
      );
      results.push({ id: event.eventId, status: type === "new_event" ? "new" : "updated" });
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function ingestMemory(source: string, demo: boolean, events: NormalisedEvent[]): IngestResult[] {
  const results: IngestResult[] = [];
  const now = new Date().toISOString();
  for (const event of events) {
    const key = `${source}|${event.eventId}`;
    const fingerprint = fingerprintEvent(event);
    const current = memEvents.get(key);
    if (current?.fingerprint === fingerprint) {
      results.push({ id: event.eventId, status: "unchanged" });
      continue;
    }
    const type = current ? "event_updated" : "new_event";
    const row: StoredEvent = { ...event, id: current?.id ?? randomUUID(), source, isDemo: demo, fingerprint, firstSeenAt: current?.firstSeenAt ?? now, updatedAt: now };
    memEvents.set(key, row);
    const duplicate = [...memNotifications.values()].some((n) => n.marketEventId === row.id && n.fingerprint === fingerprint);
    if (!duplicate) {
      const id = randomUUID();
      memNotifications.set(id, {
        id, marketEventId: row.id, fingerprint, changeType: type,
        payload: buildPayload(type, source, demo, event, current ? toEvent(current) : undefined),
        status: "pending", attempts: 0, nextAttemptAt: now, lastError: null, createdAt: now, sentAt: null,
      });
    }
    results.push({ id: event.eventId, status: current ? "updated" : "new" });
  }
  return results;
}

/** Atomically leases due notifications so concurrent workers never send the same one twice. */
export async function claimDueNotifications(limit: number): Promise<NotificationRecord[]> {
  if (db) {
    const rows = await query(
      `UPDATE market_event_notifications SET attempts=attempts+1,next_attempt_at=NOW()+($2 * INTERVAL '1 second')
       WHERE id IN (SELECT id FROM market_event_notifications WHERE status IN ('pending','failed') AND next_attempt_at<=NOW() ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
       RETURNING ${NOTE_COLUMNS}`,
      [limit, LEASE_SECONDS],
    );
    return rows.map(normaliseNoteRow);
  }
  const now = Date.now();
  const due = [...memNotifications.values()]
    .filter((n) => (n.status === "pending" || n.status === "failed") && Date.parse(n.nextAttemptAt) <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
  for (const n of due) {
    n.attempts += 1;
    n.nextAttemptAt = new Date(now + LEASE_SECONDS * 1000).toISOString();
  }
  return due.map((n) => ({ ...n }));
}

export async function markNotificationSent(id: string) {
  if (db) return void (await query(`UPDATE market_event_notifications SET status='sent',sent_at=NOW(),last_error=NULL WHERE id=$1`, [id]));
  const n = memNotifications.get(id);
  if (n) Object.assign(n, { status: "sent", sentAt: new Date().toISOString(), lastError: null });
}

export async function markNotificationFailed(id: string, attempts: number, error: string) {
  const status = attempts >= MAX_ATTEMPTS ? "dead" : "failed";
  const delay = backoffSeconds(attempts);
  const message = error.slice(0, 300);
  if (db) return void (await query(`UPDATE market_event_notifications SET status=$2,last_error=$3,next_attempt_at=NOW()+($4 * INTERVAL '1 second') WHERE id=$1`, [id, status, message, delay]));
  const n = memNotifications.get(id);
  if (n) Object.assign(n, { status, lastError: message, nextAttemptAt: new Date(Date.now() + delay * 1000).toISOString() });
}

/** Admin action: put a failed/dead notification back in the queue. */
export async function requeueNotification(id: string): Promise<boolean> {
  if (db) {
    const rows = await query(`UPDATE market_event_notifications SET status='pending',attempts=0,next_attempt_at=NOW() WHERE id=$1 AND status IN ('failed','dead') RETURNING id`, [id]);
    return rows.length > 0;
  }
  const n = memNotifications.get(id);
  if (!n || (n.status !== "failed" && n.status !== "dead")) return false;
  Object.assign(n, { status: "pending", attempts: 0, nextAttemptAt: new Date().toISOString() });
  return true;
}

export async function recordProviderReceive(source: string, demo: boolean, count: number) {
  if (db) {
    return void (await query(
      `INSERT INTO calendar_provider_status (source,is_demo,events_received,last_received_at,last_success_at) VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT (source) DO UPDATE SET is_demo=EXCLUDED.is_demo,events_received=calendar_provider_status.events_received+EXCLUDED.events_received,last_received_at=NOW(),last_success_at=NOW()`,
      [source, demo, count],
    ));
  }
  const now = new Date().toISOString();
  const p = memProviders.get(source) ?? { source, isDemo: demo, eventsReceived: 0, lastReceivedAt: null, lastSuccessAt: null, lastError: null, lastErrorAt: null };
  Object.assign(p, { isDemo: demo, eventsReceived: p.eventsReceived + count, lastReceivedAt: now, lastSuccessAt: now });
  memProviders.set(source, p);
}

export async function recordProviderFailure(source: string, error: string) {
  const message = error.slice(0, 300);
  if (db) {
    return void (await query(
      `INSERT INTO calendar_provider_status (source,last_received_at,last_error,last_error_at) VALUES ($1,NOW(),$2,NOW())
       ON CONFLICT (source) DO UPDATE SET last_received_at=NOW(),last_error=EXCLUDED.last_error,last_error_at=NOW()`,
      [source, message],
    ));
  }
  const now = new Date().toISOString();
  const p = memProviders.get(source) ?? { source, isDemo: false, eventsReceived: 0, lastReceivedAt: null, lastSuccessAt: null, lastError: null, lastErrorAt: null };
  Object.assign(p, { lastReceivedAt: now, lastError: message, lastErrorAt: now });
  memProviders.set(source, p);
}

export async function calendarSummary() {
  if (db) {
    const [events, recent, failed, providers, counts] = await Promise.all([
      query(`SELECT ${EVENT_COLUMNS} FROM market_events ORDER BY event_time DESC NULLS LAST, updated_at DESC LIMIT 50`),
      query(`SELECT ${NOTE_COLUMNS} FROM market_event_notifications ORDER BY created_at DESC LIMIT 30`),
      query(`SELECT ${NOTE_COLUMNS} FROM market_event_notifications WHERE status IN ('failed','dead') ORDER BY created_at DESC LIMIT 50`),
      query(`SELECT source,is_demo AS "isDemo",events_received::int AS "eventsReceived",last_received_at AS "lastReceivedAt",last_success_at AS "lastSuccessAt",last_error AS "lastError",last_error_at AS "lastErrorAt" FROM calendar_provider_status ORDER BY source`),
      query<{ status: string; n: number }>(`SELECT status,COUNT(*)::int AS n FROM market_event_notifications GROUP BY status`),
    ]);
    return {
      events: events.map(normaliseEventRow),
      recentChanges: recent.map(normaliseNoteRow),
      failedNotifications: failed.map(normaliseNoteRow),
      providers: (providers as any[]).map((p) => ({ ...p, lastReceivedAt: iso(p.lastReceivedAt), lastSuccessAt: iso(p.lastSuccessAt), lastErrorAt: iso(p.lastErrorAt) })) as ProviderStatus[],
      notificationCounts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    };
  }
  const notes = [...memNotifications.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts: Record<string, number> = {};
  for (const n of notes) counts[n.status] = (counts[n.status] ?? 0) + 1;
  return {
    events: [...memEvents.values()].sort((a, b) => (b.eventTime ?? "").localeCompare(a.eventTime ?? "")).slice(0, 50),
    recentChanges: notes.slice(0, 30),
    failedNotifications: notes.filter((n) => n.status === "failed" || n.status === "dead").slice(0, 50),
    providers: [...memProviders.values()],
    notificationCounts: counts,
  };
}
