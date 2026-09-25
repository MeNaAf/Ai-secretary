import { executeInSecretarySession } from "../composio/session.js";
import { getTool } from "./catalog.js";

export type ToolExecutionRequest = {
  toolSlug: string;
  userId: string;
  arguments?: Record<string, unknown>;
  connectedAccountId?: string;
  confirmed?: boolean;
  sessionId?: string;
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
      sessionId: request.sessionId
    };
  }

  const execution = await executeInSecretarySession(
    request.userId,
    request.toolSlug,
    request.arguments ?? {},
    request.sessionId
  );

  return {
    status: "executed",
    tool: definition.name,
    toolSlug: definition.slug,
    sessionId: execution.sessionId,
    result: execution.result
  };
}
