export type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type AssistantSession = {
  id: string;
  userId: string;
  composioSessionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityRecord = {
  id: string;
  userId: string;
  type: "chat" | "tool" | "confirmation" | "briefing";
  summary: string;
  toolSlug?: string;
  status: "started" | "completed" | "confirmation_required" | "failed";
  createdAt: string;
};

const users = new Map<string, UserProfile>();
const sessions = new Map<string, AssistantSession>();
const activity: ActivityRecord[] = [];

export function getOrCreateUser(userId: string): UserProfile {
  const existing = users.get(userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const user: UserProfile = {
    id: userId,
    timezone: "Africa/Johannesburg",
    createdAt: now,
    updatedAt: now
  };

  users.set(userId, user);
  return user;
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function saveSession(session: AssistantSession) {
  sessions.set(session.id, session);
  return session;
}

export function addActivity(record: Omit<ActivityRecord, "id" | "createdAt">) {
  const item: ActivityRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  activity.unshift(item);
  return item;
}

export function listActivity(userId: string, limit = 50) {
  return activity.filter((item) => item.userId === userId).slice(0, limit);
}
