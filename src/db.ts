import { Pool } from "pg";

const connectionString = (
  process.env.DATABASE_URL ??
  process.env.NETLIFY_DB_URL ??
  ""
).trim();

export const db = connectionString
  ? new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    })
  : null;

export const productionDatabase = Boolean(db);

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!db) throw new Error("Production database is not configured.");
  const result = await db.query(sql, params);
  return result.rows as T[];
}
