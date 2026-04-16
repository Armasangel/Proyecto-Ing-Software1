// lib/db.ts
// Pool singleton — una sola instancia para toda la app
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export const pool: Pool =
  globalThis._pgPool ??
  (globalThis._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  }));