import { executeTool } from "../composio/client.js";
import { getTool } from "./catalog.js";

export type ToolExecutionRequest = {
  toolSlug: string;
  userId: string;
  arguments?: Record<string, unknown>;
  connectedAccountId?: string;
  confirmed?: boolean;
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
      message: `Confirmation required before running ${definition.name}.`
    };
  }

  const result = await executeTool(
    request.toolSlug,
    request.userId,
    request.arguments ?? {},
    request.connectedAccountId
  );

  return {
    status: "executed",
    tool: definition.name,
    toolSlug: definition.slug,
    result
  };
}
