export type ToolDefinition = {
  slug: string;
  name: string;
  category: string;
  readOnly: boolean;
  requiresConfirmation: boolean;
};

export const TOOL_CATALOG: ToolDefinition[] = [
  { slug: "GMAIL_LIST_THREADS", name: "Search Gmail threads", category: "email", readOnly: true, requiresConfirmation: false },
  { slug: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", name: "Read Gmail thread", category: "email", readOnly: true, requiresConfirmation: false },
  { slug: "GMAIL_CREATE_EMAIL_DRAFT", name: "Create email draft", category: "email", readOnly: false, requiresConfirmation: false },
  { slug: "GMAIL_SEND_DRAFT", name: "Send email draft", category: "email", readOnly: false, requiresConfirmation: true },

  { slug: "GOOGLECALENDAR_EVENTS_LIST", name: "List calendar events", category: "calendar", readOnly: true, requiresConfirmation: false },
  { slug: "GOOGLECALENDAR_FREE_BUSY_QUERY", name: "Check calendar availability", category: "calendar", readOnly: true, requiresConfirmation: false },
  { slug: "GOOGLECALENDAR_CREATE_EVENT", name: "Create calendar event", category: "calendar", readOnly: false, requiresConfirmation: true },
  { slug: "GOOGLECALENDAR_PATCH_EVENT", name: "Update calendar event", category: "calendar", readOnly: false, requiresConfirmation: true },
  { slug: "GOOGLECALENDAR_DELETE_EVENT", name: "Delete calendar event", category: "calendar", readOnly: false, requiresConfirmation: true },

  { slug: "GOOGLEDRIVE_FIND_FILE", name: "Search Drive", category: "files", readOnly: true, requiresConfirmation: false },
  { slug: "GOOGLEDRIVE_DOWNLOAD_FILE", name: "Read Drive file", category: "files", readOnly: true, requiresConfirmation: false },

  { slug: "GOOGLESHEETS_VALUES_GET", name: "Read spreadsheet cells", category: "spreadsheets", readOnly: true, requiresConfirmation: false },
  { slug: "GOOGLESHEETS_VALUES_UPDATE", name: "Update spreadsheet cells", category: "spreadsheets", readOnly: false, requiresConfirmation: true },
  { slug: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", name: "Append spreadsheet rows", category: "spreadsheets", readOnly: false, requiresConfirmation: true },

  { slug: "NOTION_SEARCH_NOTION_PAGE", name: "Search Notion", category: "knowledge", readOnly: true, requiresConfirmation: false },
  { slug: "NOTION_GET_PAGE_MARKDOWN", name: "Read Notion page", category: "knowledge", readOnly: true, requiresConfirmation: false },

  { slug: "SLACK_SEARCH_ALL", name: "Search Slack", category: "messaging", readOnly: true, requiresConfirmation: false },
  { slug: "SLACK_FETCH_CONVERSATION_HISTORY", name: "Read Slack conversation", category: "messaging", readOnly: true, requiresConfirmation: false },

  { slug: "HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA", name: "Search HubSpot CRM", category: "crm", readOnly: true, requiresConfirmation: false },

  { slug: "CLICKUP_UPDATE_TASK", name: "Update ClickUp task", category: "tasks", readOnly: false, requiresConfirmation: true }
];

export function getTool(slug: string) {
  return TOOL_CATALOG.find((tool) => tool.slug === slug);
}
