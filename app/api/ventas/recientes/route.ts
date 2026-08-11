// app/api/ventas/recientes/route.ts
//
// GET /api/ventas/recientes?desde=<id_venta>
//
// Usado por el dueño para el toast de "venta realizada": el cliente
// pregunta cada pocos segundos "¿hay ventas con id mayor a X?" y si las
// hay, las devuelve para mostrar el toast. Solo el dueño puede pedir esto.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const desde = Number(searchParams.get("desde") ?? "0");

  try {
    // Si no viene "desde" (primera carga del cliente), no devolvemos ventas
    // viejas como si fueran nuevas — solo el id más alto actual, para que el
    // cliente arranque desde ahí y no dispare un toast por cada venta histórica.
    if (!desde || desde <= 0) {
      const ultimo = await pool.query(`SELECT COALESCE(MAX(id_venta), 0) AS max_id FROM venta`);
      return NextResponse.json({ ventas: [], ultimo_id: ultimo.rows[0].max_id });
    }

    const result = await pool.query(
      `SELECT
         v.id_venta,
         v.total,
         v.fecha_venta,
         u.nombre AS nombre_empleado
       FROM venta v
       LEFT JOIN usuario u ON u.id_usuario = v.id_empleado
       WHERE v.id_venta > $1
       ORDER BY v.id_venta ASC
       LIMIT 20`,
      [desde]
    );

    const maxId = result.rows.length > 0 ? result.rows[result.rows.length - 1].id_venta : desde;

    return NextResponse.json({ ventas: result.rows, ultimo_id: maxId });
  } catch (err) {
    console.error("Error en GET /api/ventas/recientes:", err);
    return NextResponse.json({ error: "Error al buscar ventas recientes" }, { status: 500 });
  }
}