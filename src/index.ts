import http from "node:http";
import { askAI } from "./ai/openrouter.js";
import { config } from "./config.js";
import type { ChatMessage, ChatRequest } from "./types.js";

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
) {
  response.writeHead(status, { "Content-Type": "application/json" });
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

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://localhost:${config.port}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "ai-secretary"
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = (await readJson(request)) as ChatRequest;

      if (typeof body.message !== "string" || !body.message.trim()) {
        sendJson(response, 400, {
          error: "message must be a non-empty string"
        });
        return;
      }

      const messages: ChatMessage[] = [
        { role: "user", content: body.message.trim() }
      ];

      const answer = await askAI(messages);

      sendJson(response, 200, {
        answer,
        model: config.openRouterModel
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);

    sendJson(response, 500, {
      error: "Internal server error"
    });
  }
});

server.listen(config.port, () => {
  console.log(`AI Secretary API listening on http://localhost:${config.port}`);
});
