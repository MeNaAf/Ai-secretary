export type Conversation = { id: string; userId: string; title?: string; createdAt: string; updatedAt: string };
export type ConversationMessage = { id: string; conversationId: string; role: "user" | "assistant" | "tool"; content: string; toolCallId?: string; createdAt: string };
export type PendingConfirmation = { id: string; userId: string; conversationId: string; toolSlug: string; arguments: Record<string, unknown>; sessionId?: string; expiresAt: string };

const conversations = new Map<string, Conversation>();
const messages = new Map<string, ConversationMessage[]>();
const confirmations = new Map<string, PendingConfirmation>();

export function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = conversations.get(conversationId);
    if (existing && existing.userId === userId) return existing;
  }
  const now = new Date().toISOString();
  const item: Conversation = { id: crypto.randomUUID(), userId, createdAt: now, updatedAt: now };
  conversations.set(item.id, item);
  messages.set(item.id, []);
  return item;
}

export function appendMessage(conversationId: string, role: ConversationMessage["role"], content: string, toolCallId?: string) {
  const conversation = conversations.get(conversationId);
  if (!conversation) throw new Error("Conversation not found.");
  const item: ConversationMessage = {
    id: crypto.randomUUID(), conversationId, role, content,
    ...(toolCallId ? { toolCallId } : {}), createdAt: new Date().toISOString()
  };
  messages.get(conversationId)?.push(item);
  conversation.updatedAt = item.createdAt;
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
  return item;
}

export function consumePendingConfirmation(id: string, userId: string) {
  const item = confirmations.get(id);
  if (!item || item.userId !== userId) return undefined;
  confirmations.delete(id);
  if (Date.parse(item.expiresAt) < Date.now()) return undefined;
  return item;
}
