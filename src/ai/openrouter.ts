import { config } from "../config.js";
import type { ChatMessage, ToolCall } from "../types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenRouterResponse = {
  content: string;
  toolCalls: ToolCall[];
};

export async function askAI(
  messages: ChatMessage[],
  tools: ToolDefinition[] = []
): Promise<OpenRouterResponse> {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "AI Secretary"
    },
    body: JSON.stringify({
      model: config.openRouterModel,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined
    })
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter request failed (${response.status}): ${await response.text()}`
    );
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          type?: "function";
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };

  const message = data.choices?.[0]?.message;

  const toolCalls = (message?.tool_calls ?? []).flatMap((call) => {
    if (!call.id || !call.function?.name) return [];

    let args: Record<string, unknown> = {};

    try {
      args = call.function.arguments
        ? JSON.parse(call.function.arguments)
        : {};
    } catch {
      throw new Error(
        `Invalid JSON arguments returned for tool ${call.function.name}`
      );
    }

    return [{
      id: call.id,
      name: call.function.name,
      arguments: args
    }];
  });

  return {
    content: message?.content ?? "",
    toolCalls
  };
}
