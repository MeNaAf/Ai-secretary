import { executeInSecretarySession } from "../composio/session.js";
import { getTool } from "./catalog.js";

export type ToolExecutionRequest = {
  toolSlug: string;
  userId: string;
  arguments?: Record<string, unknown>;
  connectedAccountId?: string;
  confirmed?: boolean;
  sessionId?: string;
  connectedAccounts?: Record<string, string>;
};

export async function runTool(request: ToolExecutionRequest) {
  const definition = getTool(request.toolSlug);

  if (!definition) {
    throw new Error(`Tool is not allowed: ${request.toolSlug}`);
  }

  if (definition.requiresConfirmation && request.confirmed !== true) {
    return {
      status: "confirmation_required",
      tool: definition.name,
      toolSlug: definition.slug,
      message: `Confirmation required before running ${definition.name}.`,
      sessionId: request.sessionId,
    };
  }

  const arguments_ = { ...(request.arguments ?? {}) };

  if ("user_id" in arguments_) {
    arguments_.user_id = request.userId;
  }

  const toolkitPrefixes: Record<string, string> = { GMAIL_: "gmail", GOOGLECALENDAR_: "googlecalendar", GOOGLEDRIVE_: "googledrive", GOOGLESHEETS_: "googlesheets", NOTION_: "notion", SLACK_: "slack", HUBSPOT_: "hubspot", CLICKUP_: "clickup" };
  const toolkit = Object.entries(toolkitPrefixes).find(([prefix]) => request.toolSlug.startsWith(prefix))?.[1];
  const selectedAccountId = request.connectedAccountId ?? (toolkit ? request.connectedAccounts?.[toolkit] : undefined);

  const execution = await executeInSecretarySession(
    request.userId,
    request.toolSlug,
    arguments_,
    request.sessionId,
    selectedAccountId,
  );

  return {
    status: "executed",
    tool: definition.name,
    toolSlug: definition.slug,
    sessionId: execution.sessionId,
    result: execution.result,
  };
}
