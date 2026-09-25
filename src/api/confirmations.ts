import type { IncomingMessage, ServerResponse } from "node:http";
import { consumePendingConfirmation, appendMessage } from "../memory/store.js";
import { runTool } from "../tools/executor.js";
import { addActivity } from "../users/store.js";

export async function confirmAction(req: IncomingMessage,res: ServerResponse,userId:string,readJson:(req:IncomingMessage)=>Promise<any>){
  if(req.method!=="POST"||req.url!=="/api/confirm")return false;
  const body=await readJson(req);
  const id=typeof body.confirmationId==="string"?body.confirmationId:"";
  if(!id)return send(res,400,{error:"confirmationId is required."});

  const pending=consumePendingConfirmation(id,userId);
  if(!pending)return send(res,410,{error:"Confirmation expired or not found."});

  try{
    const result=await runTool({
      toolSlug:pending.toolSlug,userId,arguments:pending.arguments,confirmed:true,sessionId:pending.sessionId
    });
    appendMessage(pending.conversationId,"assistant",`Completed ${pending.toolSlug.replaceAll("_"," ").toLowerCase()}.`);
    addActivity({userId,type:"tool",summary:`Completed ${pending.toolSlug}`,toolSlug:pending.toolSlug,status:"completed"});
    return send(res,200,result);
  }catch(error){
    addActivity({userId,type:"tool",summary:`Failed ${pending.toolSlug}`,toolSlug:pending.toolSlug,status:"failed"});
    return send(res,500,{error:error instanceof Error?error.message:"Tool execution failed"});
  }
}

function send(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(body));}
