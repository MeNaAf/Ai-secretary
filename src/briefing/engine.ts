import { askAI } from "../ai/openrouter.js";
import { runTool } from "../tools/executor.js";

export type BriefingItem = {
  source: string;
  kind: "email" | "calendar" | "message" | "crm";
  data: unknown;
};

export type DailyBriefingResult = {
  response: string;
  items: BriefingItem[];
  sessionId?: string;
};

function rfc3339(date: Date) {
  return date.toISOString();
}

function compact(value: unknown, max = 6000) {
  const text = JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + "...[truncated]" : text;
}

async function readTool(
  userId: string,
  toolSlug: string,
  arguments_: Record<string, unknown>,
  sessionId?: string
) {
  const result = await runTool({
    toolSlug,
    userId,
    arguments: arguments_,
    sessionId,
    confirmed: true
  });

  return {
    result: result.result,
    sessionId: result.sessionId ?? sessionId
  };
}

export async function buildDailyBriefing(
  userId: string,
  options: { sessionId?: string; now?: Date } = {}
): Promise<DailyBriefingResult> {
  const now = options.now ?? new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

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
  sessionId = email.sessionId;
  items.push({ source: "Gmail", kind: "email", data: email.result });

  const calendar = await readTool(userId, "GOOGLECALENDAR_EVENTS_LIST", {
    calendarId: "primary",
    timeMin: rfc3339(start),
    timeMax: rfc3339(end),
    orderBy: "startTime",
    singleEvents: true,
    showDeleted: false,
    maxResults: 50,
    timeZone: "Africa/Johannesburg"
  }, sessionId);
  sessionId = calendar.sessionId;
  items.push({ source: "Google Calendar", kind: "calendar", data: calendar.result });

  const slack = await readTool(userId, "SLACK_SEARCH_ALL", {
    query: "after:" + start.toISOString().slice(0, 10),
    page: 1,
    count: 20,
    sort: "timestamp",
    sort_dir: "desc"
  }, sessionId);
  sessionId = slack.sessionId;
  items.push({ source: "Slack", kind: "message", data: slack.result });

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
  sessionId = crm.sessionId;
  items.push({ source: "HubSpot", kind: "crm", data: crm.result });

  const evidence = items
    .map((item) => `### ${item.source}\n${compact(item.data)}`)
    .join("\n\n");

  const ai = await askAI([
    {
      role: "system",
      content:
        "You are AI Secretary's daily briefing engine. Summarize only the supplied evidence. " +
        "Do not invent meetings, emails, tasks, people, deadlines, or urgency. " +
        "Return a concise morning briefing with: Today, Needs attention, and Suggested next actions. " +
        "Clearly say when a source has no useful data."
    },
    {
      role: "user",
      content: `Create today's briefing for ${now.toISOString()} using this evidence:\n\n${evidence}`
    }
  ]);

  return { response: ai.content, items, sessionId };
}
