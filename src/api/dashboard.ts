import type { IncomingMessage, ServerResponse } from "node:http";
import { getOrCreateUser, listActivity } from "../users/store.js";
import { TOOL_CATALOG } from "../tools/catalog.js";

export async function dashboardResponse(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
) {
  const user = getOrCreateUser(userId);
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/api/me" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ user }));
  }

  if (url.pathname === "/api/activity" && req.method === "GET") {
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 25), 1),
      100
    );
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ items: listActivity(userId, limit) }));
  }

  if (url.pathname === "/api/tools" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({
      tools: TOOL_CATALOG.map(({ slug, name, category, requiresConfirmation }) => ({
        slug, name, category, requiresConfirmation
      }))
    }));
  }

  return false;
}
