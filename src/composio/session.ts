import { composio } from "./client.js";
import { getSession, saveSession } from "../users/store.js";

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
  "clickup",
] as const;

async function resolveConnectedAccount(userId: string, connectedAccountId: string) {
  const accounts = await composio.connectedAccounts.list({
    userIds: [userId],
    limit: 100,
  });

  const account = accounts.items.find(
    item => item.id === connectedAccountId && item.status === "ACTIVE",
  );

  if (!account) {
    throw new Error("Invalid or inactive connected account.");
  }

  const toolkit = account.toolkit.slug;
  if (!(TOOLKITS as readonly string[]).includes(toolkit)) {
    throw new Error("Connected account is not supported by AI Secretary.");
  }

  return { toolkit, id: account.id };
}

export async function createSecretarySession(
  userId: string,
  connectedAccountId?: string,
) {
  const connectedAccounts: Record<string, string[]> = {};

  if (connectedAccountId) {
    const account = await resolveConnectedAccount(userId, connectedAccountId);
    connectedAccounts[account.toolkit] = [account.id];
  }

  const session = await composio.sessions.create(userId, {
    toolkits: [...TOOLKITS],
    ...(connectedAccountId ? { connectedAccounts } : {}),
  });

  saveSession({
    id: session.sessionId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { id: session.sessionId, userId } satisfies SecretarySession;
}

export async function executeInSecretarySession(
  userId: string,
  toolSlug: string,
  arguments_: Record<string, unknown> = {},
  sessionId?: string,
  connectedAccountId?: string,
) {
  let session;

  if (sessionId) {
    const stored = getSession(sessionId);
    if (!stored || stored.userId !== userId) {
      throw new Error("Invalid or expired assistant session.");
    }

    session = await composio.sessions.use(sessionId);
  } else {
    session = await composio.sessions.create(userId, {
      toolkits: [...TOOLKITS],
    });

    saveSession({
      id: session.sessionId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (connectedAccountId) {
    const account = await resolveConnectedAccount(userId, connectedAccountId);
    const existing =
      ((session as any).config?.connectedAccounts as
        | Record<string, string[] | string>
        | undefined) ?? {};

    await session.update({
      connectedAccounts: {
        ...existing,
        [account.toolkit]: [account.id],
      },
    });
  }

  const result = await session.execute(toolSlug, arguments_);

  const stored = getSession(session.sessionId);
  saveSession({
    id: session.sessionId,
    userId,
    createdAt: stored?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    sessionId: session.sessionId,
    userId,
    result,
  };
}
