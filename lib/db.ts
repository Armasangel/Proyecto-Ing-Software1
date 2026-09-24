// lib/db.ts
// Pool singleton — una sola instancia para toda la app
import { Pool } from "pg";
import { getLogger } from "@/lib/logger";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  var _pgPoolErrorListenerAttached: boolean | undefined;
}
}

export const pool: Pool =
  globalThis._pgPool ??
  (globalThis._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  }));

// Errores no asociados a un query puntual (cliente de la pool caído, etc.).
// Sin esto se pierden en silencio y la pool puede quedar "zombie".
if (!globalThis._pgPoolErrorListenerAttached) {
  pool.on("error", (err) => {
    getLogger("lib/db").error({ err }, "Error no manejado de la pool de PostgreSQL");
  });
  globalThis._pgPoolErrorListenerAttached = true;
}
