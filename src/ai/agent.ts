import { askAI } from "./openrouter.js";
import { TOOL_CATALOG } from "../tools/catalog.js";
import { runTool } from "../tools/executor.js";
import type { ChatMessage } from "../types.js";

const SYSTEM_PROMPT = `You are AI Secretary, a practical personal and SME operations assistant.

Use connected tools when they can answer the user's request. Never invent emails, events, tasks, files, IDs, or tool results.

Read-only tools may be used to gather context. Mutating actions require explicit user confirmation. If a mutating tool is requested but confirmation has not been provided, explain what will happen and ask for confirmation.

When calling a tool, use only parameters defined by its schema. If a required ID is missing, search for it instead of inventing one.

After a tool executes, use its actual result. Never claim an action succeeded unless the tool returned success.

Be concise, useful, and proactive.`;

const tools = TOOL_CATALOG.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.slug,
    description: `${tool.name} [${tool.category}]`,
    parameters: tool.parameters
  }
}));

export async function runAgent(userId: string, message: string, sessionId?: string) {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: message }
  ];

  let currentSessionId = sessionId;

  for (let step = 0; step < 5; step++) {
    const response = await askAI(messages, tools);

    if (!response.toolCalls.length) {
      return { response: response.content, sessionId: currentSessionId };
    }

    messages.push({
      role: "assistant",
      content: response.content || `Tool calls: ${response.toolCalls.map((call) => call.name).join(", ")}`
    });

    for (const call of response.toolCalls) {
      const definition = TOOL_CATALOG.find((item) => item.slug === call.name);

      if (!definition) {
        messages.push({ role: "tool", content: JSON.stringify({ error: "Tool is not allowed." }) });
        continue;
      }

      if (definition.requiresConfirmation) {
        messages.push({
          role: "tool",
          content: JSON.stringify({
            status: "confirmation_required",
            tool: definition.name,
            toolSlug: definition.slug,
            arguments: call.arguments
          })
        });
        continue;
      }

      const result = await runTool({
        toolSlug: call.name,
        userId,
        arguments: call.arguments,
        sessionId: currentSessionId,
        confirmed: true
      });

      currentSessionId = result.sessionId ?? currentSessionId;

      messages.push({
        role: "tool",
        content: JSON.stringify({
          toolCallId: call.id,
          tool: call.name,
          result
        })
      });
    }
  }

  return {
    response: "I reached the tool-execution limit for this request. Please narrow the request and try again.",
    sessionId: currentSessionId
  };
}
