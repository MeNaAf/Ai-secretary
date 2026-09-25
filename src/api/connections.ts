import type { IncomingMessage, ServerResponse } from "node:http";
import { composio } from "../composio/client.js";

const SUPPORTED_TOOLKITS = ["gmail","googlecalendar","googledrive","googlesheets","notion","slack","hubspot","clickup"] as const;
const LABELS: Record<string,string> = {gmail:"Gmail",googlecalendar:"Google Calendar",googledrive:"Google Drive",googlesheets:"Google Sheets",notion:"Notion",slack:"Slack",hubspot:"HubSpot",clickup:"ClickUp"};

function sendJson(res: ServerResponse,status:number,body:unknown){res.writeHead(status,{"content-type":"application/json; charset=utf-8"});res.end(JSON.stringify(body));}

export async function connectionsResponse(req:IncomingMessage,res:ServerResponse,userId:string){
  const url=new URL(req.url??"/","http://localhost");

  if(req.method==="GET"&&url.pathname==="/api/connections"){
    const accounts=await composio.connectedAccounts.list({userIds:[userId],limit:100});
    return sendJson(res,200,{
      items:SUPPORTED_TOOLKITS.map(toolkit=>{
        const matches=accounts.items.filter(account=>account.toolkit.slug===toolkit);
        const active=matches.find(account=>account.status==="ACTIVE")??matches[0];
        return {
          toolkit,
          name:LABELS[toolkit],
          connected:active?.status==="ACTIVE",
          status:active?.status??"NOT_CONNECTED",
          accounts:matches.map(account=>({
            id:account.id,
            status:account.status,
            alias:account.alias??null,
            updatedAt:account.updatedAt??null
          }))
        };
      })
    });
  }

  const match=url.pathname.match(/^\/api\/connections\/([^/]+)(\/reconnect)?$/);
  if(req.method==="POST"&&match){
    const toolkit=decodeURIComponent(match[1]);
    const reconnect=Boolean(match[2]);
    if(!SUPPORTED_TOOLKITS.includes(toolkit as typeof SUPPORTED_TOOLKITS[number]))return sendJson(res,400,{error:"Unsupported integration."});

    const session=await composio.sessions.create(userId,{toolkits:[toolkit],manageConnections:true});
    if(!reconnect){
      const accounts=await composio.connectedAccounts.list({userIds:[userId],limit:100});
      const active=accounts.items.find(account=>account.toolkit.slug===toolkit&&account.status==="ACTIVE");
      if(active)return sendJson(res,200,{toolkit,name:LABELS[toolkit],connected:true,accountId:active.id,alias:active.alias??null,reused:true});
    }
    const request=await session.authorize(toolkit);
    return sendJson(res,200,{toolkit,name:LABELS[toolkit],redirectUrl:request.redirectUrl,reconnect});
  }

  return false;
}
