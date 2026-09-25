import type { IncomingMessage, ServerResponse } from "node:http";
import { consumePendingConfirmation } from "../memory/store.js";
import { runTool } from "../tools/executor.js";

export async function confirmAction(req: IncomingMessage, res: ServerResponse, userId: string, readJson: (req: IncomingMessage) => Promise<any>) {
  if (req.method !== "POST" || req.url !== "/api/confirm") return false;
  const body = await readJson(req);
  const id = typeof body.confirmationId === "string" ? body.confirmationId : "";
  if (!id) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "confirmationId is required" })); return true; }
  const pending = consumePendingConfirmation(id, userId);
  if (!pending) { res.writeHead(410, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Confirmation expired or not found" })); return true; }
  const result = await runTool({ toolSlug: pending.toolSlug, userId, arguments: pending.arguments, confirmed: true });
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result)); return true;
}