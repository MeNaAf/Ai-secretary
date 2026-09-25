export type ToolDefinition = {
  slug: string;
  name: string;
  category: string;
  requiresConfirmation: boolean;
  parameters: Record<string, unknown>;
};

const stringParam = (description: string) => ({ type: "string", description });
const integerParam = (description: string) => ({ type: "integer", description, minimum: 1 });
const booleanParam = (description: string) => ({ type: "boolean", description });

export const TOOL_CATALOG: ToolDefinition[] = [
  {
    slug: "GMAIL_LIST_LABELS",
    name: "List Gmail labels",
    category: "email",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      properties: {
        user_id: stringParam("Gmail account identifier, usually me."),
        include_details: booleanParam("Include message and thread counts.")
      }
    }
  },
  {
    slug: "GMAIL_LIST_THREADS",
    name: "List Gmail threads",
    category: "email",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      properties: {
        user_id: stringParam("Gmail account identifier, usually me."),
        query: stringParam("Gmail search query."),
        max_results: integerParam("Maximum number of threads to return.")
      }
    }
  },
  {
    slug: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID",
    name: "Fetch Gmail thread",
    category: "email",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["thread_id"],
      properties: {
        user_id: stringParam("Gmail account identifier, usually me."),
        thread_id: stringParam("The Gmail thread ID.")
      }
    }
  },
  {
    slug: "GMAIL_CREATE_EMAIL_DRAFT",
    name: "Create Gmail draft",
    category: "email",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["to", "subject", "body"],
      properties: {
        to: stringParam("Recipient email address."),
        subject: stringParam("Email subject."),
        body: stringParam("Email body.")
      }
    }
  },
  {
    slug: "GMAIL_SEND_DRAFT",
    name: "Send Gmail draft",
    category: "email",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["draft_id"],
      properties: {
        draft_id: stringParam("Gmail draft ID to send.")
      }
    }
  },
  {
    slug: "GOOGLECALENDAR_LIST_CALENDARS",
    name: "List calendars",
    category: "calendar",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      properties: {
        max_results: integerParam("Maximum calendars to return."),
        show_hidden: booleanParam("Include hidden calendars."),
        show_deleted: booleanParam("Include deleted calendars.")
      }
    }
  },
  {
    slug: "GOOGLECALENDAR_EVENTS_LIST",
    name: "List calendar events",
    category: "calendar",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      properties: {
        calendar_id: stringParam("Calendar ID, usually primary."),
        time_min: stringParam("Start of the time range in RFC3339 format."),
        time_max: stringParam("End of the time range in RFC3339 format."),
        max_results: integerParam("Maximum events to return.")
      }
    }
  },
  {
    slug: "GOOGLECALENDAR_FREE_BUSY_QUERY",
    name: "Check calendar availability",
    category: "calendar",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["time_min", "time_max"],
      properties: {
        time_min: stringParam("Start of the time range in RFC3339 format."),
        time_max: stringParam("End of the time range in RFC3339 format."),
        items: { type: "array", items: { type: "object" } }
      }
    }
  },
  {
    slug: "GOOGLECALENDAR_CREATE_EVENT",
    name: "Create calendar event",
    category: "calendar",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["summary", "start", "end"],
      properties: {
        calendar_id: stringParam("Calendar ID, usually primary."),
        summary: stringParam("Event title."),
        description: stringParam("Event description."),
        start: { type: "object", description: "Google Calendar start date/time object." },
        end: { type: "object", description: "Google Calendar end date/time object." }
      }
    }
  },
  {
    slug: "GOOGLECALENDAR_PATCH_EVENT",
    name: "Update calendar event",
    category: "calendar",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["event_id"],
      properties: {
        calendar_id: stringParam("Calendar ID, usually primary."),
        event_id: stringParam("Event ID."),
        summary: stringParam("New event title."),
        description: stringParam("New event description.")
      }
    }
  },
  {
    slug: "GOOGLECALENDAR_DELETE_EVENT",
    name: "Delete calendar event",
    category: "calendar",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["event_id"],
      properties: {
        calendar_id: stringParam("Calendar ID, usually primary."),
        event_id: stringParam("Event ID.")
      }
    }
  },
  {
    slug: "GOOGLEDRIVE_FIND_FILE",
    name: "Search Google Drive",
    category: "files",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      properties: {
        query: stringParam("Natural-language or Drive search query."),
        page_size: integerParam("Maximum results.")
      }
    }
  },
  {
    slug: "GOOGLEDRIVE_DOWNLOAD_FILE",
    name: "Read Google Drive file",
    category: "files",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["file_id"],
      properties: {
        file_id: stringParam("Google Drive file ID.")
      }
    }
  },
  {
    slug: "GOOGLESHEETS_VALUES_GET",
    name: "Read Google Sheet values",
    category: "sheets",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["spreadsheet_id", "range"],
      properties: {
        spreadsheet_id: stringParam("Spreadsheet ID from the URL."),
        range: stringParam("A1 range, for example Sheet1!A1:D20.")
      }
    }
  },
  {
    slug: "GOOGLESHEETS_VALUES_UPDATE",
    name: "Update Google Sheet values",
    category: "sheets",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["spreadsheet_id", "range", "values"],
      properties: {
        spreadsheet_id: stringParam("Spreadsheet ID."),
        range: stringParam("A1 range."),
        values: { type: "array", description: "2D array of values." }
      }
    }
  },
  {
    slug: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    name: "Append Google Sheet values",
    category: "sheets",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["spreadsheet_id", "range", "values"],
      properties: {
        spreadsheet_id: stringParam("Spreadsheet ID."),
        range: stringParam("A1 range."),
        values: { type: "array", description: "2D array of values." }
      }
    }
  },
  {
    slug: "NOTION_SEARCH_NOTION_PAGE",
    name: "Search Notion",
    category: "knowledge",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      properties: {
        query: stringParam("Search text.")
      }
    }
  },
  {
    slug: "NOTION_GET_PAGE_MARKDOWN",
    name: "Read Notion page",
    category: "knowledge",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["page_id"],
      properties: {
        page_id: stringParam("Notion page ID.")
      }
    }
  },
  {
    slug: "SLACK_SEARCH_ALL",
    name: "Search Slack",
    category: "messaging",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: stringParam("Slack search query.")
      }
    }
  },
  {
    slug: "SLACK_FETCH_CONVERSATION_HISTORY",
    name: "Read Slack conversation",
    category: "messaging",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["channel"],
      properties: {
        channel: stringParam("Slack channel ID.")
      }
    }
  },
  {
    slug: "HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA",
    name: "Search HubSpot CRM",
    category: "crm",
    requiresConfirmation: false,
    parameters: {
      type: "object",
      required: ["objectType"],
      properties: {
        objectType: stringParam("HubSpot object type such as contacts, companies, or deals."),
        filterGroups: { type: "array", description: "HubSpot filter groups." },
        properties: { type: "array", items: { type: "string" }, description: "Properties to return." },
        limit: integerParam("Maximum records to return.")
      }
    }
  },
  {
    slug: "CLICKUP_UPDATE_TASK",
    name: "Update ClickUp task",
    category: "tasks",
    requiresConfirmation: true,
    parameters: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: stringParam("ClickUp task ID."),
        name: stringParam("New task name."),
        description: stringParam("New task description."),
        status: stringParam("New task status.")
      }
    }
  }
];

export function getTool(slug: string) {
  return TOOL_CATALOG.find((tool) => tool.slug === slug);
}
