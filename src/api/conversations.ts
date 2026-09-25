import type { IncomingMessage, ServerResponse } from "node:http";
import { listMessages } from "../memory/store.js";

export function conversationResponse(req: IncomingMessage, res: ServerResponse, userId: string) {
  const match = new URL(req.url ?? "/", "http://localhost").pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (req.method !== "GET" || !match) return false;
  try {
    const items = listMessages(match[1], userId);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ items }));
  } catch {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "Conversation not found" }));
  }
  return true;
}