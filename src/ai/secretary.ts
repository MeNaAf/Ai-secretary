import { askAI } from "./openrouter.js";
import { TOOL_CATALOG } from "../tools/catalog.js";
import type { ChatMessage } from "../types.js";

const TOOL_SUMMARY = TOOL_CATALOG.map((tool) =>
  `- ${tool.slug}: ${tool.name} [${tool.category}] ${tool.requiresConfirmation ? "CONFIRMATION REQUIRED" : "read-only/safe"}`
).join("\n");

const PLANNER_PROMPT = `
You are the planning layer of AI Secretary.

You can reason across connected business and personal services through Composio.
Available tool capabilities:
${TOOL_SUMMARY}

Rules:
1. Prefer read-only tools to gather context before taking actions.
2. Never claim an action was completed unless the tool executor confirms it.
3. Sending email, deleting events, creating or changing appointments, changing CRM/task records, or writing business data requires explicit user confirmation.
4. When an action is needed, return a concise plan with the exact tool slug(s) needed.
5. If no external tool is needed, answer normally.
6. Do not invent IDs, calendar names, message IDs, task IDs, or file IDs.
`;

export async function planRequest(message: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: PLANNER_PROMPT },
    { role: "user", content: message }
  ];

  return askAI(messages);
}
