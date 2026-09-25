import type { IncomingMessage, ServerResponse } from "node:http";
import { consumePendingConfirmation, appendMessage } from "../memory/store.js";
import { runTool } from "../tools/executor.js";
import { addActivity } from "../users/store.js";

export async function confirmAction(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string,
  readJson: (req: IncomingMessage) => Promise<any>
) {
  if (req.method !== "POST" || req.url !== "/api/confirm") return false;

  const body = await readJson(req);
  const id = typeof body.confirmationId === "string" ? body.confirmationId : "";

  if (!id) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "confirmationId is required" }));
    return true;
  }

  const pending = consumePendingConfirmation(id, userId);
  if (!pending) {
    res.writeHead(410, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Confirmation expired or not found" }));
    return true;
  }

  try {
    const result = await runTool({
      toolSlug: pending.toolSlug,
      userId,
      arguments: pending.arguments,
      confirmed: true,
      sessionId: pending.sessionId
    });

    appendMessage(
      pending.conversationId,
      "assistant",
      `Completed ${pending.toolSlug.replaceAll("_", " ").toLowerCase()}.`
    );

    addActivity({
      userId,
      type: "tool",
      summary: `Completed ${pending.toolSlug}`,
      toolSlug: pending.toolSlug,
      status: "completed"
    });

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    addActivity({
      userId,
      type: "tool",
      summary: `Failed ${pending.toolSlug}`,
      toolSlug: pending.toolSlug,
      status: "failed"
    });

    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : "Tool execution failed"
    }));
  }

  return true;
}
