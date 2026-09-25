export type ToolDefinition = {
  slug: string;
  name: string;
  category: string;
  requiresConfirmation: boolean;
  parameters: Record<string, unknown>;
};

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  ...(required.length ? { required } : {}),
  properties,
});

const s = (description: string) => ({ type: "string", description });
const i = (description: string) => ({ type: "integer", description });
const b = (description: string) => ({ type: "boolean", description });

export const TOOL_CATALOG: ToolDefinition[] = [
  {
    slug: "GMAIL_LIST_LABELS", name: "List Gmail labels", category: "email", requiresConfirmation: false,
    parameters: obj({ user_id: s("Gmail account identifier, usually me."), include_details: b("Include label message/thread counts.") }),
  },
  {
    slug: "GMAIL_LIST_THREADS", name: "List Gmail threads", category: "email", requiresConfirmation: false,
    parameters: obj({ user_id: s("Gmail account identifier, usually me."), query: s("Gmail search query."), verbose: b("Include full thread message details."), page_token: s("Opaque Gmail pagination token."), max_results: i("Maximum threads to return.") }),
  },
  {
    slug: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", name: "Fetch Gmail thread", category: "email", requiresConfirmation: false,
    parameters: obj({ user_id: s("Gmail account identifier, usually me."), thread_id: s("Gmail API thread ID."), page_token: s("Opaque pagination token.") }, ["thread_id"]),
  },
  {
    slug: "GMAIL_FETCH_EMAILS", name: "Fetch Gmail emails", category: "email", requiresConfirmation: false,
    parameters: obj({ user_id: s("Gmail account identifier, usually me."), query: s("Gmail search query."), verbose: b("Return detailed message content."), ids_only: b("Return IDs only."), page_token: s("Opaque pagination token."), max_results: i("Maximum messages per page."), include_payload: b("Include full payload."), include_spam_trash: b("Include spam and trash.") }),
  },
  {
    slug: "GMAIL_CREATE_EMAIL_DRAFT", name: "Create Gmail draft", category: "email", requiresConfirmation: true,
    parameters: obj({
      user_id: s("Gmail account identifier, usually me."), recipient_email: s("Primary recipient email."), extra_recipients: { type: "array", items: s("Additional recipient email.") },
      cc: { type: "array", items: s("CC email.") }, bcc: { type: "array", items: s("BCC email.") }, subject: s("Email subject."), body: s("Email body."), is_html: b("Whether body is HTML."), thread_id: s("Existing Gmail thread ID for a reply.")
    }),
  },
  {
    slug: "GMAIL_SEND_DRAFT", name: "Send Gmail draft", category: "email", requiresConfirmation: true,
    parameters: obj({ user_id: s("Gmail account identifier, usually me."), draft_id: s("Existing Gmail draft ID.") }, ["draft_id"]),
  },

  {
    slug: "GOOGLECALENDAR_LIST_CALENDARS", name: "List calendars", category: "calendar", requiresConfirmation: false,
    parameters: obj({ max_results: i("Maximum calendars to return."), show_hidden: b("Include hidden calendars."), show_deleted: b("Include deleted calendars."), min_access_role: s("Minimum access role.") }),
  },
  {
    slug: "GOOGLECALENDAR_EVENTS_LIST", name: "List calendar events", category: "calendar", requiresConfirmation: false,
    parameters: obj({
      calendarId: s("Calendar ID, usually primary."), timeMin: s("RFC3339 lower time bound."), timeMax: s("RFC3339 upper time bound."),
      query: s("Free-text event search."), orderBy: s("startTime or updated."), singleEvents: b("Expand recurring events."), showDeleted: b("Include cancelled events."),
      maxResults: i("Maximum events per page."), pageToken: s("Opaque pagination token."), timeZone: s("IANA timezone for response formatting.")
    }),
  },
  {
    slug: "GOOGLECALENDAR_FREE_BUSY_QUERY", name: "Check calendar availability", category: "calendar", requiresConfirmation: false,
    parameters: obj({ timeMin: s("RFC3339 start time."), timeMax: s("RFC3339 end time."), items: { type: "array", items: { type: "object", required: ["id"], properties: { id: s("Calendar or group ID.") } } }, timeZone: s("IANA timezone.") }, ["timeMin", "timeMax", "items"]),
  },
  {
    slug: "GOOGLECALENDAR_CREATE_EVENT", name: "Create calendar event", category: "calendar", requiresConfirmation: true,
    parameters: obj({
      calendar_id: s("Calendar ID, usually primary."), summary: s("Event title."), description: s("Event description."), location: s("Event location."),
      start_datetime: s("Start datetime, preferably RFC3339."), end_datetime: s("End datetime, preferably RFC3339."), duration: s("Optional duration if supported by the action."),
      timezone: s("IANA timezone."), attendees: { type: "array", items: { anyOf: [s("Attendee email."), { type: "object" }] } },
      send_updates: s("all, externalOnly, or none.")
    }, ["start_datetime"]),
  },
  {
    slug: "GOOGLECALENDAR_PATCH_EVENT", name: "Update calendar event", category: "calendar", requiresConfirmation: true,
    parameters: obj({
      calendar_id: s("Calendar ID."), event_id: s("Event ID."), summary: s("New title."), start_time: s("New RFC3339 start time or all-day date."),
      end_time: s("New RFC3339 end time or all-day date."), timezone: s("IANA timezone."), location: s("New location."), description: s("New description."),
      status: s("confirmed, tentative, or cancelled.")
    }, ["calendar_id", "event_id"]),
  },
  {
    slug: "GOOGLECALENDAR_DELETE_EVENT", name: "Delete calendar event", category: "calendar", requiresConfirmation: true,
    parameters: obj({ calendar_id: s("Calendar ID, usually primary."), event_id: s("Event ID."), send_updates: s("all, externalOnly, or none.") }, ["event_id"]),
  },

  {
    slug: "GOOGLEDRIVE_FIND_FILE", name: "Search Google Drive", category: "files", requiresConfirmation: false,
    parameters: obj({ q: s("Google Drive query, e.g. name contains 'report'."), fields: s("Partial response fields."), pageSize: i("Maximum files per page."), pageToken: s("Opaque pagination token."), orderBy: s("Drive sort expression."), corpora: s("user, drive, domain, or allDrives."), driveId: s("Shared drive ID."), folder_id: s("Folder ID, or root."), includeItemsFromAllDrives: b("Include shared drive items."), supportsAllDrives: b("Support shared drives.") }),
  },
  {
    slug: "GOOGLEDRIVE_DOWNLOAD_FILE", name: "Read Google Drive file", category: "files", requiresConfirmation: false,
    parameters: obj({ fileId: s("Google Drive file ID.") }, ["fileId"]),
  },

  {
    slug: "GOOGLESHEETS_VALUES_GET", name: "Read Google Sheet values", category: "sheets", requiresConfirmation: false,
    parameters: obj({ spreadsheet_id: s("Spreadsheet ID."), range: s("A1/R1C1 range."), start_row: i("Optional 1-based start row."), end_row: i("Optional 1-based end row."), major_dimension: s("DIMENSION_UNSPECIFIED, ROWS, or COLUMNS."), value_render_option: s("FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA."), date_time_render_option: s("SERIAL_NUMBER or FORMATTED_STRING.") }, ["spreadsheet_id", "range"]),
  },
  {
    slug: "GOOGLESHEETS_VALUES_UPDATE", name: "Update Google Sheet values", category: "sheets", requiresConfirmation: true,
    parameters: obj({ spreadsheet_id: s("Spreadsheet ID."), range: s("A1 range."), values: { type: "array", items: { type: "array" } }, value_input_option: s("RAW or USER_ENTERED."), major_dimension: s("ROWS or COLUMNS."), auto_expand_sheet: b("Automatically expand sheet dimensions.") }, ["spreadsheet_id", "range", "value_input_option", "values"]),
  },
  {
    slug: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", name: "Append Google Sheet rows", category: "sheets", requiresConfirmation: true,
    parameters: obj({ spreadsheetId: s("Spreadsheet ID."), range: s("Sheet-qualified A1 range."), valueInputOption: s("RAW or USER_ENTERED."), values: { type: "array", items: { type: "array" } }, majorDimension: s("ROWS or COLUMNS."), insertDataOption: s("OVERWRITE or INSERT_ROWS.") }, ["spreadsheetId", "range", "valueInputOption", "values"]),
  },

  {
    slug: "NOTION_SEARCH_NOTION_PAGE", name: "Search Notion", category: "knowledge", requiresConfirmation: false,
    parameters: obj({ query: s("Notion title search."), page_size: i("Results per page."), filter_value: s("page or database."), filter_property: s("object."), direction: s("ascending or descending."), timestamp: s("last_edited_time."), start_cursor: s("Opaque pagination cursor.") }),
  },
  {
    slug: "NOTION_GET_PAGE_MARKDOWN", name: "Read Notion page", category: "knowledge", requiresConfirmation: false,
    parameters: obj({ page_id: s("Notion page UUID."), include_transcript: b("Include meeting note transcripts.") }, ["page_id"]),
  },

  {
    slug: "SLACK_SEARCH_ALL", name: "Search Slack", category: "messaging", requiresConfirmation: false,
    parameters: obj({ query: s("Slack search query."), page: i("Result page."), count: i("Results per page."), sort: s("score or timestamp."), sort_dir: s("asc or desc."), team_id: s("Slack workspace ID.") }, ["query"]),
  },
  {
    slug: "SLACK_FETCH_CONVERSATION_HISTORY", name: "Read Slack conversation", category: "messaging", requiresConfirmation: false,
    parameters: obj({ channel: s("Slack channel or conversation ID."), limit: i("Maximum messages."), cursor: s("Opaque pagination cursor."), oldest: s("Unix or Slack timestamp."), latest: s("Unix or Slack timestamp."), inclusive: b("Include boundary timestamps.") }, ["channel"]),
  },

  {
    slug: "HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA", name: "Search HubSpot CRM", category: "crm", requiresConfirmation: false,
    parameters: obj({
      objectType: s("contacts, companies, deals, tickets, tasks, or another supported HubSpot object type."), query: s("Broad CRM search text."),
      limit: i("Maximum results per page."), after: s("Pagination cursor."), properties: { type: "array", items: s("HubSpot property name.") },
      sorts: { type: "array", items: { anyOf: [s("Sort property expression."), { type: "object" }] } }, filterGroups: { type: "array", items: { type: "object" } }
    }, ["objectType"]),
  },

  {
    slug: "CLICKUP_UPDATE_TASK", name: "Update ClickUp task", category: "tasks", requiresConfirmation: true,
    parameters: obj({
      task_id: s("ClickUp task ID."), name: s("New task name."), description: s("New task description."), status: s("New task status."),
      due_date: i("Due date in Unix milliseconds."), due_date_time: b("Whether due_date includes a time."), priority: i("1 urgent, 2 high, 3 normal, 4 low."),
      start_date: i("Start date in Unix milliseconds."), start_date_time: b("Whether start_date includes a time.")
    }, ["task_id"]),
  },
];

export function getTool(slug: string) {
  return TOOL_CATALOG.find((tool) => tool.slug === slug);
}
