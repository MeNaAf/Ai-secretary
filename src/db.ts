import { getConnectionString, getDatabase } from "@netlify/database";

let dbClient: ReturnType<typeof getDatabase> | null = null;

function resolveConnectionString() {
  const envUrl = process.env.NETLIFY_DB_URL?.trim();
  if (envUrl) return envUrl;

  try {
    return getConnectionString();
  } catch {
    return "";
  }
}

try {
  const connectionString = resolveConnectionString();

  // Netlify Functions run through Lambda compatibility in this project.
  // In that runtime Netlify recommends passing the connection string explicitly.
  dbClient = connectionString
    ? getDatabase({ connectionString })
    : getDatabase();
} catch {
  dbClient = null;
}

export const productionDatabase = Boolean(dbClient);
export const db = dbClient;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!db) throw new Error("Production database is not configured.");
  return (await db.sql.unsafe(sql, params)) as T[];
}
