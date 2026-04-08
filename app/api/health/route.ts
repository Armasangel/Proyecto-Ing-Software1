// app/api/health/route.ts
// Endpoint de prueba: GET /api/health
// Verifica que Next.js puede conectarse a PostgreSQL

import { NextResponse } from "next/server";
import { Pool } from "pg";

// El pool reutiliza conexiones — no crear uno por request en producción,
// pero para desarrollo / health-check está bien así.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS hora_servidor, current_database() AS base_de_datos"
    );

    return NextResponse.json({
      status: "ok",
      mensaje: "Conexión a PostgreSQL exitosa ✅",
      base_de_datos: result.rows[0].base_de_datos,
      hora_servidor: result.rows[0].hora_servidor,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        mensaje: "No se pudo conectar a PostgreSQL ❌",
        detalle: String(error),
      },
      { status: 500 }
    );
  }
}