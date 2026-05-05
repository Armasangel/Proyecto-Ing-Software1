// app/api/bodegas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await pool.query(
      `SELECT
         b.id_bodega,
         b.nombre_bodega,
         b.ubicacion,
         COUNT(DISTINCT bp.id_producto)::int AS total_productos,
         COALESCE(SUM(bp.cantidad_disponible), 0)::numeric AS stock_total
       FROM bodega b
       LEFT JOIN bodega_producto bp ON bp.id_bodega = b.id_bodega
       GROUP BY b.id_bodega
       ORDER BY b.nombre_bodega`
    );
    return NextResponse.json({ bodegas: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar bodegas", detalle: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { nombre_bodega, ubicacion } = await req.json();

    if (!nombre_bodega || !String(nombre_bodega).trim()) {
      return NextResponse.json(
        { error: "El nombre de la bodega es obligatorio" },
        { status: 400 }
      );
    }

    const existe = await pool.query(
      `SELECT 1 FROM bodega WHERE LOWER(nombre_bodega) = LOWER($1)`,
      [String(nombre_bodega).trim()]
    );
    if (existe.rowCount && existe.rowCount > 0) {
      return NextResponse.json(
        { error: "Ya existe una bodega con ese nombre" },
        { status: 409 }
      );
    }

    const result = await pool.query(
      `INSERT INTO bodega (nombre_bodega, ubicacion)
       VALUES ($1, $2)
       RETURNING id_bodega, nombre_bodega, ubicacion`,
      [String(nombre_bodega).trim(), ubicacion ? String(ubicacion).trim() : null]
    );

    return NextResponse.json({ bodega: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear bodega", detalle: String(error) },
      { status: 500 }
    );
  }
}