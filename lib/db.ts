// lib/db.ts
// Pool singleton — una sola instancia para toda la app
import { Pool } from "pg";
import { getLogger } from "@/lib/logger";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  var _pgPoolErrorListenerAttached: boolean | undefined;
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool: Pool =
  globalThis._pgPool ??
  (globalThis._pgPool = new Pool({
    connectionString: DATABASE_URL,
    // Evita agotar conexiones bajo carga y cuelgues en despliegue
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Reintentos cortos para evitar bloquear el evento loop
    keepAlive: true,
  }));

// Errores no asociados a un query puntual (cliente de la pool caído, etc.).
// Sin esto se pierden en silencio y la pool puede quedar "zombie".
if (!globalThis._pgPoolErrorListenerAttached) {
  pool.on("error", (err) => {
    getLogger("lib/db").error({ err }, "Error no manejado de la pool de PostgreSQL");
  });
  globalThis._pgPoolErrorListenerAttached = true;
}
