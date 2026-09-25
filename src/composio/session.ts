import { composio } from "./client.js";

export type SecretarySession = {
  id: string;
  userId: string;
};

const TOOLKITS = [
  "gmail",
  "googlecalendar",
  "googledrive",
  "googlesheets",
  "notion",
  "slack",
  "hubspot",
  "clickup"
] as const;

export async function createSecretarySession(userId: string) {
  const session = await composio.sessions.create(userId, {
    toolkits: [...TOOLKITS]
  });

  return {
    id: session.sessionId,
    userId
  } satisfies SecretarySession;
}

export async function executeInSecretarySession(
  userId: string,
  toolSlug: string,
  arguments_: Record<string, unknown> = {},
  sessionId?: string
) {
  const session = sessionId
    ? await composio.sessions.use(sessionId)
    : await composio.sessions.create(userId, {
        toolkits: [...TOOLKITS]
      });

  const result = await session.execute(toolSlug, arguments_);

  return {
    sessionId: session.sessionId,
    userId,
    result
  };
}
