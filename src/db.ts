import { getDatabase } from "@netlify/database";
export const productionDatabase=process.env.NETLIFY==="true"||Boolean(process.env.NETLIFY_DB_URL);
export const db=productionDatabase?getDatabase():null;
export async function query<T=Record<string,unknown>>(sql:string,params:unknown[]=[]):Promise<T[]>{if(!db)throw new Error("Production database is not configured.");return await db.sql.unsafe(sql,params) as T[];}
