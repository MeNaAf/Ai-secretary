import test from "node:test";
import assert from "node:assert/strict";
import { createPendingConfirmation, consumePendingConfirmation } from "../src/memory/store.js";

test("pending confirmation is user-scoped and one-time", () => {
  const item = createPendingConfirmation({
    userId: "user-a",
    conversationId: "conversation-a",
    toolSlug: "CLICKUP_CREATE_TASK",
    arguments: { name: "Test task" },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(consumePendingConfirmation(item.id, "user-b"), undefined);
  assert.equal(consumePendingConfirmation(item.id, "user-a")?.toolSlug, "CLICKUP_CREATE_TASK");
  assert.equal(consumePendingConfirmation(item.id, "user-a"), undefined);
});

test("expired confirmation is rejected", () => {
  const item = createPendingConfirmation({
    userId: "user-expired",
    conversationId: "conversation-expired",
    toolSlug: "GMAIL_SEND_EMAIL",
    arguments: { to: "test@example.com" },
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });
  assert.equal(consumePendingConfirmation(item.id, "user-expired"), undefined);
});
