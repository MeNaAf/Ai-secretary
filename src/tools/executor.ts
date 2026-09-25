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

  const arguments_ = {...(request.arguments ?? {})};
  // The authenticated application user is authoritative. Never allow model/client
  // arguments to select another Composio user identity.
  if ("user_id" in arguments_) delete arguments_.user_id;

  const execution = await executeInSecretarySession(
    request.userId,
    request.toolSlug,
    arguments_,
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