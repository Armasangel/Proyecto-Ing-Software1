import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

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
    console.error("[HEALTH]", error);

    // En producción no revelamos detalles del error de BD al cliente
    const detalle =
      process.env.NODE_ENV !== "production"
        ? String(error)
        : "Revisa los logs del servidor";

    return NextResponse.json(
      {
        status: "error",
        mensaje: "No se pudo conectar a PostgreSQL ❌",
        detalle,
      },
      { status: 500 }
    );
  }
}