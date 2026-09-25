import { composio } from "./client.js";
import { getSession, saveSession } from "../users/store.js";

export type SecretarySession = {
  id: string;
  userId: string;
};

const TOOLKITS = [
  "gmail",
  "googlecalendar",
  "googledrive",
  "googlesheets",
  "notion",
  "slack",
  "hubspot",
  "clickup"
] as const;

export async function createSecretarySession(userId: string) {
  const session = await composio.sessions.create(userId, { toolkits: [...TOOLKITS] });
  saveSession({id:session.sessionId,userId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  return { id: session.sessionId, userId } satisfies SecretarySession;
}

export async function executeInSecretarySession(userId:string,toolSlug:string,arguments_:Record<string,unknown>={},sessionId?:string) {
  let session;
  if(sessionId){
    const stored=getSession(sessionId);
    if(!stored||stored.userId!==userId) throw new Error("Invalid or expired assistant session.");
    session=await composio.sessions.use(sessionId);
  } else {
    session=await composio.sessions.create(userId,{toolkits:[...TOOLKITS]});
    saveSession({id:session.sessionId,userId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  }
  const result=await session.execute(toolSlug,arguments_);
  const stored=getSession(session.sessionId);
  saveSession({id:session.sessionId,userId,createdAt:stored?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()});
  return {sessionId:session.sessionId,userId,result};
}
