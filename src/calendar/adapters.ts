import { createHash } from "node:crypto";
import type { NormalisedEvent } from "./types.js";

export const MAX_EVENTS_PER_REQUEST = 500;
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class PayloadError extends Error {}

export type ParsedPayload = { source: string; demo: boolean; events: NormalisedEvent[] };

/**
 * A provider adapter converts one licensed provider's payload into the normalised format.
 * Register an adapter per provider with registerAdapter(); unknown sources use the normalised adapter.
 */
export type ProviderAdapter = { parse(payload: unknown): ParsedPayload };

function text(value: unknown, max = 500): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

function isoTime(value: unknown): string | null {
  const raw = text(value, 64);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new PayloadError("event_time must be a valid ISO-8601 timestamp.");
  return new Date(ms).toISOString();
}

function httpUrl(value: unknown): string | null {
  const raw = text(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normaliseEvent(raw: Record<string, unknown>): NormalisedEvent | null {
  const eventId = text(raw.event_id, 200);
  const name = text(raw.event_name, 300);
  if (!eventId || !name) return null;
  return {
    eventId,
    name,
    country: text(raw.country, 100),
    currency: text(raw.currency, 16),
    impact: text(raw.impact, 32),
    eventTime: isoTime(raw.event_time),
    forecast: text(raw.forecast, 100),
    previous: text(raw.previous, 100),
    actual: text(raw.actual, 100),
    sourceUrl: httpUrl(raw.source_url),
  };
}

export const normalisedAdapter: ProviderAdapter = {
  parse(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new PayloadError("Payload must be a JSON object.");
    const body = payload as Record<string, unknown>;
    const source = typeof body.source === "string" && body.source ? body.source.trim().toLowerCase() : "licensed-provider";
    if (!SOURCE_PATTERN.test(source)) throw new PayloadError("source must be 1-64 chars of a-z, 0-9, '.', '_' or '-'.");
    const rawEvents = Array.isArray(body.events) ? body.events : [body];
    if (rawEvents.length > MAX_EVENTS_PER_REQUEST) throw new PayloadError(`At most ${MAX_EVENTS_PER_REQUEST} events per request.`);
    const events: NormalisedEvent[] = [];
    for (const item of rawEvents) {
      if (!item || typeof item !== "object") throw new PayloadError("Each event must be an object.");
      const event = normaliseEvent(item as Record<string, unknown>);
      if (!event) throw new PayloadError("Each event needs event_id and event_name.");
      events.push(event);
    }
    if (events.length === 0) throw new PayloadError("No events supplied.");
    return { source, demo: body.demo === true || source.startsWith("demo"), events };
  },
};

const adapters = new Map<string, ProviderAdapter>();

export function registerAdapter(source: string, adapter: ProviderAdapter) {
  adapters.set(source, adapter);
}

export function parsePayload(payload: unknown): ParsedPayload {
  const source = payload && typeof payload === "object" && typeof (payload as { source?: unknown }).source === "string"
    ? String((payload as { source: string }).source).trim().toLowerCase()
    : "";
  return (adapters.get(source) ?? normalisedAdapter).parse(payload);
}

/** Hash of the fields whose change should trigger an alert. Key order is fixed. */
export function fingerprintEvent(event: NormalisedEvent): string {
  return createHash("sha256")
    .update(JSON.stringify([event.name, event.country, event.currency, event.impact, event.eventTime, event.forecast, event.previous, event.actual]))
    .digest("hex");
}

const TRACKED: (keyof NormalisedEvent)[] = ["name", "country", "currency", "impact", "eventTime", "forecast", "previous", "actual"];

export function diffEvents(before: NormalisedEvent, after: NormalisedEvent) {
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  for (const key of TRACKED) if (before[key] !== after[key]) changes[key] = { from: before[key], to: after[key] };
  return changes;
}
