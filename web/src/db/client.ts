import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Two connections with different rights: reads only ever see the views in schema api.
const g = globalThis as unknown as { __ro?: Pool; __rw?: Pool };

function ro() { return (g.__ro ??= new Pool({ connectionString: env.databaseUrlRo, max: 10, statement_timeout: 15000 })); }
function rw() { return (g.__rw ??= new Pool({ connectionString: env.databaseUrlRw, max: 10, statement_timeout: 60000 })); }

export const q = async <T extends QueryResultRow = any>(text: string, params: unknown[] = []) => (await ro().query<T>(text, params)).rows;
export const q1 = async <T extends QueryResultRow = any>(text: string, params: unknown[] = []) => (await q<T>(text, params))[0] as T | undefined;
export const w = async <T extends QueryResultRow = any>(text: string, params: unknown[] = []) => (await rw().query<T>(text, params)).rows;

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await rw().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function db() { return (_db ??= drizzle(rw(), { schema })); }
