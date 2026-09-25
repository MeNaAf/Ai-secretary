import "dotenv/config";
import { createServer } from "node:http";
import { config } from "./config.js";
import { runSecretary } from "./ai/secretary.js";
import { runTool } from "./tools/executor.js";
import { runOpenRouter } from "./ai/openrouter.js";

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: import("node:http").IncomingMessage) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "ai-secretary",
        composioConfigured: Boolean(config.composioApiKey),
        openRouterConfigured: Boolean(config.openRouterApiKey)
      });
    }

    if (req.method === "POST" && req.url === "/api/chat") {
      const body = await readJson(req);
      const userId = typeof body.userId === "string" ? body.userId : "local-dev-user";
      const message = typeof body.message === "string" ? body.message : "";

      if (!message.trim()) {
        return sendJson(res, 400, { error: "message is required" });
      }

      const result = await runOpenRouter(
        await runSecretary({
          userId,
          message
        })
      );

      return sendJson(res, 200, {
        userId,
        response: result
      });
    }

    if (req.method === "POST" && req.url === "/api/plan") {
      const body = await readJson(req);
      const userId = typeof body.userId === "string" ? body.userId : "local-dev-user";
      const message = typeof body.message === "string" ? body.message : "";

      if (!message.trim()) {
        return sendJson(res, 400, { error: "message is required" });
      }

      return sendJson(res, 200, await runSecretary({ userId, message }));
    }

    if (req.method === "POST" && req.url === "/api/tool/execute") {
      if (!config.composioApiKey) {
        return sendJson(res, 503, { error: "COMPOSIO_API_KEY is not configured." });
      }

      const body = await readJson(req);
      const toolSlug = typeof body.toolSlug === "string" ? body.toolSlug : "";
      const userId = typeof body.userId === "string" ? body.userId : "local-dev-user";
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

      if (!toolSlug) {
        return sendJson(res, 400, { error: "toolSlug is required" });
      }

      const result = await runTool({
        toolSlug,
        userId,
        sessionId,
        arguments:
          body.arguments && typeof body.arguments === "object"
            ? body.arguments
            : {},
        confirmed: body.confirmed === true
      });

      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return sendJson(res, 500, { error: message });
  }
});

server.listen(config.port, () => {
  console.log(`AI Secretary listening on http://localhost:${config.port}`);
});
