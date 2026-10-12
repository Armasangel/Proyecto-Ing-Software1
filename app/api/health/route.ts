import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

// Un health check que se cuelga no puede reportar "caído": si PostgreSQL no
// responde, este endpoint tiene que devolver 500 rápido para que el monitoreo
// externo (.github/workflows/health-check.yml) lo detecte. 
const TIMEOUT_MS = 5000;

export async function GET() {
  try {
    const resultado = await Promise.race([
      pool.query("SELECT NOW() AS hora_servidor"),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout esperando a la base de datos")),
          TIMEOUT_MS
        )
      ),
    ]);

    return NextResponse.json({
      status: "ok",
      mensaje: "Conexión a la base de datos exitosa ✅",
      hora_servidor: resultado.rows[0].hora_servidor,
    });
  } catch (error) {
    logger.error({ err: error }, "Health check falló — conexión a la base de datos");

    // El detalle del error se queda en el log del servidor. Al cliente solo
    // se le dice qué hacer, nunca el mensaje crudo de `pg` (que puede incluir
    // host, puerto, nombre de tabla o código SQLSTATE).
    return NextResponse.json(
      {
        status: "error",
        mensaje: "No se pudo conectar a la base de datos ❌",
        detalle: "Revisa los logs del servidor",
      },
      { status: 500 }
    );
  }
}
