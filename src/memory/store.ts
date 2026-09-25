import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Conversation = { id: string; userId: string; title?: string; createdAt: string; updatedAt: string };
export type ConversationMessage = { id: string; conversationId: string; role: "user" | "assistant" | "tool"; content: string; toolCallId?: string; createdAt: string };
export type PendingConfirmation = { id: string; userId: string; conversationId: string; toolSlug: string; arguments: Record<string, unknown>; sessionId?: string; expiresAt: string };

type MemorySnapshot = {
  conversations: Conversation[];
  messages: ConversationMessage[];
  confirmations: PendingConfirmation[];
};

const storagePath = resolve(process.env.AI_SECRETARY_DATA_DIR ?? "./data", "memory.json");
const conversations = new Map<string, Conversation>();
const messages = new Map<string, ConversationMessage[]>();
const confirmations = new Map<string, PendingConfirmation>();

function hydrate() {
  try {
    if (!existsSync(storagePath)) return;
    const snapshot = JSON.parse(readFileSync(storagePath, "utf8")) as Partial<MemorySnapshot>;
    for (const item of snapshot.conversations ?? []) conversations.set(item.id, item);
    for (const item of snapshot.messages ?? []) {
      const bucket = messages.get(item.conversationId) ?? [];
      bucket.push(item);
      messages.set(item.conversationId, bucket);
    }
    for (const item of snapshot.confirmations ?? []) {
      if (Date.parse(item.expiresAt) > Date.now()) confirmations.set(item.id, item);
    }
  } catch {
    // Corrupt or unavailable local memory should not prevent the assistant from starting.
  }
}

function persist() {
  try {
    mkdirSync(dirname(storagePath), { recursive: true });
    const snapshot: MemorySnapshot = {
      conversations: [...conversations.values()],
      messages: [...messages.values()].flat(),
      confirmations: [...confirmations.values()]
    };
    const tempPath = storagePath + ".tmp";
    writeFileSync(tempPath, JSON.stringify(snapshot), "utf8");
    renameSync(tempPath, storagePath);
  } catch {
    // Persistence is best-effort for the $0 MVP. Runtime memory remains available.
  }
}

hydrate();

export function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = conversations.get(conversationId);
    if (existing && existing.userId === userId) return existing;
  }
  const now = new Date().toISOString();
  const item: Conversation = { id: crypto.randomUUID(), userId, createdAt: now, updatedAt: now };
  conversations.set(item.id, item);
  messages.set(item.id, []);
  persist();
  return item;
}

export function appendMessage(conversationId: string, role: ConversationMessage["role"], content: string, toolCallId?: string) {
  const conversation = conversations.get(conversationId);
  if (!conversation) throw new Error("Conversation not found.");
  const item: ConversationMessage = {
    id: crypto.randomUUID(), conversationId, content, role,
    ...(toolCallId ? { toolCallId } : {}), createdAt: new Date().toISOString()
  };
  messages.get(conversationId)?.push(item);
  conversation.updatedAt = item.createdAt;
  persist();
  return item;
}

export function listMessages(conversationId: string, userId: string) {
  const conversation = conversations.get(conversationId);
  if (!conversation || conversation.userId !== userId) throw new Error("Conversation not found.");
  return messages.get(conversationId) ?? [];
}

export function createPendingConfirmation(input: Omit<PendingConfirmation, "id">) {
  const item = { ...input, id: crypto.randomUUID() };
  confirmations.set(item.id, item);
  persist();
  return item;
}

export function consumePendingConfirmation(id: string, userId: string) {
  const item = confirmations.get(id);
  if (!item || item.userId !== userId) return undefined;
  confirmations.delete(id);
  persist();
  if (Date.parse(item.expiresAt) < Date.now()) return undefined;
  return item;
}
