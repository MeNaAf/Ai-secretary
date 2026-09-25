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

  // Tool schemas may expose user_id as a required parameter. It is safe to
  // provide it because this value always comes from the authenticated session,
  // never from the client/model request.
  if ("user_id" in arguments_) arguments_.user_id = request.userId;

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