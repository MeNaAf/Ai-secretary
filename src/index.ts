import http from "node:http";
import { planRequest } from "./ai/secretary.js";
import { askAI } from "./ai/openrouter.js";
import { config } from "./config.js";
import { runTool } from "./tools/executor.js";
import type { ChatMessage, ChatRequest, ToolRequest } from "./types.js";

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value.trim();
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://localhost:${config.port}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "ai-secretary",
        composioConfigured: Boolean(config.composioApiKey),
        openRouterConfigured: Boolean(config.openRouterApiKey)
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = (await readJson(request)) as ChatRequest;
      const message = requireString(body.message, "message");

      const messages: ChatMessage[] = [{ role: "user", content: message }];
      const answer = await askAI(messages);

      sendJson(response, 200, {
        answer,
        mode: "chat",
        model: config.openRouterModel
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/plan") {
      const body = (await readJson(request)) as ChatRequest;
      const message = requireString(body.message, "message");

      const plan = await planRequest(message);

      sendJson(response, 200, {
        plan,
        mode: "secretary-planner",
        model: config.openRouterModel
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tool/execute") {
      const body = (await readJson(request)) as ToolRequest;

      if (!config.composioApiKey) {
        sendJson(response, 503, {
          error: "Composio is not configured. Add COMPOSIO_API_KEY to the server environment."
        });
        return;
      }

      const toolSlug = requireString(body.toolSlug, "toolSlug");
      const userId = requireString(body.userId, "userId");

      const result = await runTool({
        toolSlug,
        userId,
        arguments:
          body.arguments && typeof body.arguments === "object"
            ? (body.arguments as Record<string, unknown>)
            : {},
        connectedAccountId:
          typeof body.connectedAccountId === "string"
            ? body.connectedAccountId
            : undefined,
        confirmed: body.confirmed === true
      });

      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);

    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Request failed"
    });
  }
});

server.listen(config.port, () => {
  console.log(`AI Secretary API listening on http://localhost:${config.port}`);
});
