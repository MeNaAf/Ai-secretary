import "dotenv/config";
import { createServer } from "node:http";
import { config } from "./config.js";
import { runAgent } from "./ai/agent.js";
import { runSecretary } from "./ai/secretary.js";
import { runTool } from "./tools/executor.js";
import { dashboardResponse } from "./api/dashboard.js";
import { getOrCreateUser, addActivity } from "./users/store.js";

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: import("node:http").IncomingMessage) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url ?? "";

    if (req.method === "GET" && url === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "ai-secretary",
        composioConfigured: Boolean(config.composioApiKey),
        openRouterConfigured: Boolean(config.openRouterApiKey)
      });
    }

    if (url.startsWith("/api/me") || url.startsWith("/api/activity") || url.startsWith("/api/tools")) {
      const userId = typeof req.headers["x-user-id"] === "string"
        ? req.headers["x-user-id"]
        : "local-dev-user";
      getOrCreateUser(userId);
      if (await dashboardResponse(req, res, userId)) return;
    }

    if (req.method === "POST" && url === "/api/chat") {
      const body = await readJson(req);
      const userId = typeof body.userId === "string" ? body.userId : "local-dev-user";
      const message = typeof body.message === "string" ? body.message : "";
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

      if (!message.trim()) return sendJson(res, 400, { error: "message is required" });

      getOrCreateUser(userId);
      addActivity({
        userId,
        type: "chat",
        summary: message.slice(0, 160),
        status: "started"
      });

      const result = await runAgent(userId, message, sessionId);

      addActivity({
        userId,
        type: result.confirmationRequired ? "confirmation" : "chat",
        summary: result.confirmationRequired
          ? `Confirmation required for ${result.action?.toolSlug ?? "action"}`
          : "Assistant response completed",
        toolSlug: result.action?.toolSlug,
        status: result.confirmationRequired ? "confirmation_required" : "completed"
      });

      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url === "/api/plan") {
      const body = await readJson(req);
      const userId = typeof body.userId === "string" ? body.userId : "local-dev-user";
      const message = typeof body.message === "string" ? body.message : "";

      if (!message.trim()) return sendJson(res, 400, { error: "message is required" });

      return sendJson(res, 200, await runSecretary({ userId, message }));
    }

    if (req.method === "POST" && url === "/api/tool/execute") {
      if (!config.composioApiKey) {
        return sendJson(res, 503, { error: "COMPOSIO_API_KEY is not configured." });
      }

      const body = await readJson(req);
      const toolSlug = typeof body.toolSlug === "string" ? body.toolSlug : "";
      const userId = typeof body.userId === "string" ? body.userId : "local-dev-user";

      if (!toolSlug) return sendJson(res, 400, { error: "toolSlug is required" });

      const result = await runTool({
        toolSlug,
        userId,
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
        arguments: body.arguments && typeof body.arguments === "object" ? body.arguments : {},
        confirmed: body.confirmed === true
      });

      addActivity({
        userId,
        type: "tool",
        summary: `Tool ${toolSlug}`,
        toolSlug,
        status: result.status === "confirmation_required" ? "confirmation_required" : "completed"
      });

      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected error"
    });
  }
});

server.listen(config.port, () => {
  console.log(`AI Secretary listening on http://localhost:${config.port}`);
});
