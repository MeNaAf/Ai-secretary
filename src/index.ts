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

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) { res.writeHead(status, {"content-type":"application/json; charset=utf-8"}); res.end(JSON.stringify(body)); }
async function readJson(req: import("node:http").IncomingMessage) { let body=""; for await (const chunk of req) body+=chunk; return body ? JSON.parse(body) : {}; }
async function servePublic(res: import("node:http").ServerResponse, path: string) {
  const safe=path===" /" ? "index.html" : path.replace(/^\/+/, "");
  const file=join(process.cwd(),"public",safe);
  if (safe.includes("..")) return false;
  const type={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"}[extname(file)] ?? "application/octet-stream";
  try { const data=await readFile(file); res.writeHead(200,{"content-type":type,"cache-control":"no-cache"}); res.end(data); return true; } catch { return false; }
}
const server=createServer(async(req,res)=>{
  try {
    const url=req.url??"";
    if(req.method==="GET" && (url==="/" || url.startsWith("/styles.css") || url.startsWith("/app.js"))) { if(await servePublic(res,new URL(url,"http://localhost").pathname)) return; }
    const userId=typeof req.headers["x-user-id"]==="string"?req.headers["x-user-id"]:"local-dev-user";
    if(req.method==="GET" && url==="/health") return sendJson(res,200,{ok:true,service:"ai-secretary",composioConfigured:Boolean(config.composioApiKey),openRouterConfigured:Boolean(config.openRouterApiKey)});
    if(url.startsWith("/api/me")||url.startsWith("/api/activity")||url.startsWith("/api/tools")) { getOrCreateUser(userId); if(await dashboardResponse(req,res,userId)) return; }
    if(url.startsWith("/api/conversations/")) { if(conversationResponse(req,res,userId)) return; }
    if(req.method==="POST" && url==="/api/chat") {
      const body=await readJson(req),message=typeof body.message==="string"?body.message:"",bodyUserId=typeof body.userId==="string"?body.userId:userId;
      const conversation=getOrCreateConversation(bodyUserId,typeof body.conversationId==="string"?body.conversationId:undefined),sessionId=typeof body.sessionId==="string"?body.sessionId:undefined;
      if(!message.trim()) return sendJson(res,400,{error:"message is required"});
      getOrCreateUser(bodyUserId); appendMessage(conversation.id,"user",message); addActivity({userId:bodyUserId,type:"chat",summary:message.slice(0,160),status:"started"});
      const result=await runAgent(bodyUserId,message,sessionId,conversation.id);
      if(result.confirmationRequired&&result.action){const pending=createPendingConfirmation({userId:bodyUserId,conversationId:conversation.id,toolSlug:result.action.toolSlug,arguments:result.action.arguments,expiresAt:new Date(Date.now()+10*60*1000).toISOString()});addActivity({userId:bodyUserId,type:"confirmation",summary:"Confirmation required for "+result.action.toolSlug,toolSlug:result.action.toolSlug,status:"confirmation_required"});return sendJson(res,200,{...result,conversationId:conversation.id,confirmationId:pending.id});}
      if(result.response) appendMessage(conversation.id,"assistant",result.response); addActivity({userId:bodyUserId,type:"chat",summary:"Assistant response completed",status:"completed"}); return sendJson(res,200,{...result,conversationId:conversation.id});
    }
    if(req.method==="POST"&&url==="/api/confirm") return await confirmAction(req,res,userId,readJson);
    if(req.method==="POST"&&url==="/api/plan"){const body=await readJson(req),bodyUserId=typeof body.userId==="string"?body.userId:userId,message=typeof body.message==="string"?body.message:"";if(!message.trim())return sendJson(res,400,{error:"message is required"});return sendJson(res,200,await runSecretary({userId:bodyUserId,message}));}
    if(req.method==="POST"&&url==="/api/tool/execute"){if(!config.composioApiKey)return sendJson(res,503,{error:"COMPOSIO_API_KEY is not configured."});const body=await readJson(req),toolSlug=typeof body.toolSlug==="string"?body.toolSlug:"";if(!toolSlug)return sendJson(res,400,{error:"toolSlug is required"});return sendJson(res,200,await runTool({toolSlug,userId,sessionId:typeof body.sessionId==="string"?body.sessionId:undefined,arguments:body.arguments&&typeof body.arguments==="object"?body.arguments:{},confirmed:body.confirmed===true}));}
    return sendJson(res,404,{error:"Not found"});
  } catch(error){return sendJson(res,500,{error:error instanceof Error?error.message:"Unexpected error"});}
});
server.listen(config.port,()=>console.log("AI Secretary listening on http://localhost:"+config.port));
