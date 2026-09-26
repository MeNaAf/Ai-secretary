import { askAI } from "../ai/openrouter.js";
import { runTool } from "../tools/executor.js";
import { getOrCreateUser } from "../users/store.js";

export type BriefingItem = {
  source: string;
  kind: "email" | "calendar" | "message" | "crm";
  data: unknown;
  status?: "ok" | "unavailable";
  error?: string;
};

export type DailyBriefingResult = {
  response: string;
  items: BriefingItem[];
  sessionId?: string;
};

function iso(date: Date) {
  return date.toISOString();
}

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function zonedMidnightUtc(dateKey: string, timeZone: string) {
  const guess = Date.parse(`${dateKey}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(guess));
  const offsetPart = parts.find(part => part.type === "timeZoneName")?.value ?? "GMT";
  const match = offsetPart.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = match
    ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1)
    : 0;
  return new Date(guess - offsetMinutes * 60_000);
}

function compact(value: unknown, max = 6000) {
  const text = JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + "...[truncated]" : text;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "Source unavailable.";
}

async function readTool(
  userId: string,
  toolSlug: string,
  arguments_: Record<string, unknown>,
  sessionId?: string
) {
  try {
    const result = await runTool({
      toolSlug,
      userId,
      arguments: arguments_,
      sessionId,
      confirmed: true
    });

    return {
      ok: true as const,
      result: result.result,
      sessionId: result.sessionId ?? sessionId
    };
  } catch (error) {
    return {
      ok: false as const,
      error: safeError(error),
      sessionId
    };
  }
}

function addRead(
  items: BriefingItem[],
  source: string,
  kind: BriefingItem["kind"],
  read: Awaited<ReturnType<typeof readTool>>
) {
  if (read.ok) {
    items.push({ source, kind, data: read.result, status: "ok" });
    return read.sessionId;
  }

  items.push({
    source,
    kind,
    data: null,
    status: "unavailable",
    error: read.error
  });
  return read.sessionId;
}

export async function buildDailyBriefing(
  userId: string,
  options: { sessionId?: string; now?: Date } = {}
): Promise<DailyBriefingResult> {
  const now = options.now ?? new Date();
  const profile = getOrCreateUser(userId);
  const timeZone = profile.timezone || "Africa/Johannesburg";

  const todayKey = localDateKey(now, timeZone);
  const start = zonedMidnightUtc(todayKey, timeZone);
  const tomorrowKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(Date.parse(todayKey + "T00:00:00Z") + 24 * 60 * 60 * 1000));
  const end = zonedMidnightUtc(tomorrowKey, timeZone);

  let sessionId = options.sessionId;
  const items: BriefingItem[] = [];

  const email = await readTool(userId, "GMAIL_FETCH_EMAILS", {
    user_id: "me",
    query: "is:unread OR is:important",
    verbose: false,
    ids_only: false,
    max_results: 15,
    include_payload: false,
    include_spam_trash: false
  }, sessionId);
  sessionId = addRead(items, "Gmail", "email", email) ?? sessionId;

  const calendar = await readTool(userId, "GOOGLECALENDAR_EVENTS_LIST", {
    calendarId: "primary",
    timeMin: iso(start),
    timeMax: iso(end),
    orderBy: "startTime",
    singleEvents: true,
    showDeleted: false,
    maxResults: 50,
    timeZone
  }, sessionId);
  sessionId = addRead(items, "Google Calendar", "calendar", calendar) ?? sessionId;

  const slack = await readTool(userId, "SLACK_SEARCH_ALL", {
    query: "after:" + todayKey,
    page: 1,
    count: 20,
    sort: "timestamp",
    sort_dir: "desc"
  }, sessionId);
  sessionId = addRead(items, "Slack", "message", slack) ?? sessionId;

  const crm = await readTool(userId, "HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA", {
    objectType: "tasks",
    limit: 20,
    sorts: ["-hs_timestamp"],
    properties: [
      "hs_task_subject",
      "hs_task_status",
      "hs_task_priority",
      "hs_timestamp"
    ]
  }, sessionId);
  sessionId = addRead(items, "HubSpot", "crm", crm) ?? sessionId;

  const evidence = items
    .map(item => {
      const status = item.status === "unavailable"
        ? `UNAVAILABLE: ${item.error}`
        : compact(item.data);
      return `### ${item.source}\n${status}`;
    })
    .join("\n\n");

  const ai = await askAI([
    {
      role: "system",
      content:
        "You are AI Secretary's daily briefing engine. Summarize only the supplied evidence. " +
        "Do not invent meetings, emails, tasks, people, deadlines, or urgency. " +
        "Return a concise morning briefing with: Today, Needs attention, and Suggested next actions. " +
        "Clearly identify unavailable sources and never treat missing data as no data."
    },
    {
      role: "user",
      content: `Create today's briefing for ${now.toISOString()} in timezone ${timeZone} using this evidence:\n\n${evidence}`
    }
  ]);

  return { response: ai.content, items, sessionId };
}
