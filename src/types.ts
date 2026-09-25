export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
    };

export type ChatRequest = {
  message?: unknown;
  userId?: unknown;
  sessionId?: unknown;
};

export type ToolRequest = {
  toolSlug?: unknown;
  userId?: unknown;
  arguments?: unknown;
  connectedAccountId?: unknown;
  confirmed?: unknown;
  sessionId?: unknown;
};
