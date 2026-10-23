import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// One client per process. Next.js dev reloads modules; keep it on globalThis.
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client = g.__pg ?? postgres(url, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") g.__pg = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };

/** A db or a transaction: what the pipeline helpers accept. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Dbx = Db | Tx;
