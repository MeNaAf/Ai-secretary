import { Composio } from "@composio/core";

const apiKey = process.env.COMPOSIO_API_KEY;

if (!apiKey) {
  throw new Error("COMPOSIO_API_KEY is not configured.");
}

export const composio = new Composio({ apiKey });

export async function executeTool(
  toolSlug: string,
  userId: string,
  arguments_: Record<string, unknown> = {},
  connectedAccountId?: string
) {
  return composio.tools.execute(toolSlug, {
    userId,
    arguments: arguments_,
    ...(connectedAccountId ? { connectedAccountId } : {})
  });
}
