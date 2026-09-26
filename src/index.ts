import "dotenv/config";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { config } from "./config.js";
import { runAgent } from "./ai/agent.js";
import { runSecretary } from "./ai/secretary.js";
import { runTool } from "./tools/executor.js";
import { dashboardResponse } from "./api/dashboard.js";
import { conversationResponse } from "./api/conversations.js";
import { confirmAction } from "./api/confirmations.js";
import { getOrCreateUser, addActivity } from "./users/store.js";
import { getOrCreateConversation, appendMessage, createPendingConfirmation } from "./memory/store.js";
import { buildDailyBriefing } from "./briefing/engine.js";
import { connectionsResponse } from "./api/connections.js";
import { listMemories, forgetMemory } from "./memory/semantic.js";
import { register, login, logout, userFromSession, sessionCookie, clearSessionCookie } from "./auth/store.js";

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown, headers: Record<string,string> = {}) { res.writeHead(status, {"content-type":"application/json; charset=utf-8", ...headers}); res.end(JSON.stringify(body)); }
const MAX_REQUEST_BYTES = 1_000_000;

async function readJson(req: import("node:http").IncomingMessage) {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    const error = new Error("Request body too large.");
    (error as Error & { statusCode?: number }).statusCode = 413;
    throw error;
  }
  let body="";
  let size=0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk as string | Buffer);
    if (size > MAX_REQUEST_BYTES) {
      const error = new Error("Request body too large.");
      (error as Error & { statusCode?: number }).statusCode = 413;
      throw error;
    }
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}
async function servePublic(res: import("node:http").ServerResponse, path: string) {
  const safe=path==="/" ? "index.html" : path.replace(/^\/+/, "");
  if (safe.includes("..")) return false;
  const file=join(process.cwd(),"public",safe);
  const type={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"}[extname(file)] ?? "application/octet-stream";
  try { const data=await readFile(file); res.writeHead(200,{"content-type":type,"cache-control":"no-cache"}); res.end(data); return true; } catch { return false; }
}
const server=createServer(async(req,res)=>{
  try {
    const url=req.url??"";
    if(req.method==="GET" && (url==="/" || url.startsWith("/styles.css") || url.startsWith("/app.js"))) { if(await servePublic(res,new URL(url,"http://localhost").pathname)) return; }
    const cookies=typeof req.headers.cookie==="string"?Object.fromEntries(req.headers.cookie.split(";").map(v=>v.trim().split("=")).filter(v=>v.length===2)):{};
    const authenticated=userFromSession(cookies.ai_secretary_session);
    const devIdentityAllowed=process.env.AI_SECRETARY_ALLOW_DEV_IDENTITY==="true";
    const userId=authenticated?.id ?? (devIdentityAllowed && typeof req.headers["x-user-id"]==="string"?req.headers["x-user-id"]:"");

    if(req.method==="POST" && url==="/api/auth/register"){const body=await readJson(req);try{register(typeof body.email==="string"?body.email:"",typeof body.password==="string"?body.password:"");const auth=login(typeof body.email==="string"?body.email:"",typeof body.password==="string"?body.password:"");return sendJson(res,201,{user:auth.user},{"set-cookie":sessionCookie(auth.sessionId)})}catch(error){return sendJson(res,400,{error:error instanceof Error?error.message:"Registration failed"})}}
    if(req.method==="POST" && url==="/api/auth/login"){const body=await readJson(req);try{const auth=login(typeof body.email==="string"?body.email:"",typeof body.password==="string"?body.password:"");return sendJson(res,200,{user:auth.user},{"set-cookie":sessionCookie(auth.sessionId)})}catch(error){return sendJson(res,401,{error:error instanceof Error?error.message:"Invalid email or password"})}}
    if(req.method==="POST" && url==="/api/auth/logout"){logout(cookies.ai_secretary_session);return sendJson(res,200,{ok:true},{"set-cookie":clearSessionCookie()})}
    if(req.method==="GET" && url==="/api/auth/me")return sendJson(res,200,{authenticated:Boolean(authenticated),user:authenticated??null});
    if(!userId)return sendJson(res,401,{error:"Authentication required."});

    if(req.method==="GET" && url==="/health") return sendJson(res,200,{ok:true,service:"ai-secretary",composioConfigured:Boolean(config.composioApiKey),openRouterConfigured:Boolean(config.openRouterApiKey)});
    if(url.startsWith("/api/me")||url.startsWith("/api/activity")||url.startsWith("/api/tools")) { getOrCreateUser(userId); if(await dashboardResponse(req,res,userId)) return; }
    if(url.startsWith("/api/connections")) { if(await connectionsResponse(req,res,userId)) return; }
    if(url.startsWith("/api/conversations/")) { if(conversationResponse(req,res,userId)) return; }
    if(url==="/api/memories" && req.method==="GET") return sendJson(res,200,{items:listMemories(userId)});
    if(url.startsWith("/api/memories/") && req.method==="DELETE"){
      const memoryId=url.slice("/api/memories/".length);
      if(!memoryId)return sendJson(res,400,{error:"memory id is required"});
      const removed=forgetMemory(userId,memoryId);
      return sendJson(res,removed?200:404,removed?{ok:true}:{error:"Memory not found"});
    }
    if(req.method==="POST" && url==="/api/chat") {
      const body=await readJson(req),message=typeof body.message==="string"?body.message:"";
      const conversation=getOrCreateConversation(userId,typeof body.conversationId==="string"?body.conversationId:undefined),sessionId=typeof body.sessionId==="string"?body.sessionId:undefined;
      const connectedAccounts=body.connectedAccounts&&typeof body.connectedAccounts==="object"&&!Array.isArray(body.connectedAccounts)?Object.fromEntries(Object.entries(body.connectedAccounts).filter(([k,v])=>typeof k==="string"&&typeof v==="string")) as Record<string,string>:{};
      if(!message.trim()) return sendJson(res,400,{error:"message is required"});
      getOrCreateUser(userId); appendMessage(conversation.id,"user",message); addActivity({userId,type:"chat",summary:message.slice(0,160),status:"started"});
      const result=await runAgent(userId,message,sessionId,conversation.id,connectedAccounts);
      if(result.confirmationRequired&&result.action){const pending=createPendingConfirmation({userId,conversationId:conversation.id,toolSlug:result.action.toolSlug,arguments:result.action.arguments,sessionId:result.sessionId,expiresAt:new Date(Date.now()+10*60*1000).toISOString()});addActivity({userId,type:"confirmation",summary:"Confirmation required for "+result.action.toolSlug,toolSlug:result.action.toolSlug,status:"confirmation_required"});return sendJson(res,200,{...result,conversationId:conversation.id,confirmationId:pending.id});}
      if(result.response) appendMessage(conversation.id,"assistant",result.response); addActivity({userId,type:"chat",summary:"Assistant response completed",status:"completed"}); return sendJson(res,200,{...result,conversationId:conversation.id});
    }
    if(req.method==="POST"&&url==="/api/briefing"){
      if(!config.composioApiKey)return sendJson(res,503,{error:"COMPOSIO_API_KEY is not configured."});
      if(!config.openRouterApiKey)return sendJson(res,503,{error:"OPENROUTER_API_KEY is not configured."});
      const body=await readJson(req),sessionId=typeof body.sessionId==="string"?body.sessionId:undefined;
      getOrCreateUser(userId);
      const result=await buildDailyBriefing(userId,{sessionId});
      addActivity({userId,type:"briefing",summary:"Daily briefing generated",status:"completed"});
      return sendJson(res,200,result);
    }
    if(req.method==="POST"&&url==="/api/confirm") return await confirmAction(req,res,userId,readJson);
    if(req.method==="POST"&&url==="/api/plan"){const body=await readJson(req),message=typeof body.message==="string"?body.message:"";if(!message.trim())return sendJson(res,400,{error:"message is required"});return sendJson(res,200,await runSecretary({userId,message}));}
    return sendJson(res,404,{error:"Not found"});
  } catch(error){return sendJson(res,(error as {statusCode?:number})?.statusCode===413?413:500,{error:error instanceof Error?error.message:"Unexpected error"});}
});
server.listen(config.port,()=>console.log("AI Secretary listening on http://localhost:"+config.port));