import { getConnectionString,getDatabase } from "@netlify/database";

let dbClient: ReturnType<typeof getDatabase>|null=null;
try{
  const connectionString=getConnectionString();
  dbClient=getDatabase({connectionString});
}catch{
  try{dbClient=getDatabase()}catch{dbClient=null}
}

export const productionDatabase=Boolean(dbClient);
export const db=dbClient;

export async function query<T=Record<string,unknown>>(sql:string,params:unknown[]=[]):Promise<T[]>{
  if(!db)throw new Error("Production database is not configured.");
  return await db.sql.unsafe(sql,params) as T[];
}
