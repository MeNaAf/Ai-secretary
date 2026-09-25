export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  message?: unknown;
  userId?: unknown;
};

export type ToolRequest = {
  toolSlug?: unknown;
  userId?: unknown;
  arguments?: unknown;
  connectedAccountId?: unknown;
  confirmed?: unknown;
};
