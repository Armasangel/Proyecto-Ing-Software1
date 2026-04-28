import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

const TIPOS = ["ENTRADA", "SALIDA", "AJUSTE"] as const;
type TipoMov = (typeof TIPOS)[number];

function isTipoMov(s: string): s is TipoMov {
  return (TIPOS as readonly string[]).includes(s);
}

/**
 * GET /api/gestion-inventario/kardex
 * Historial de movimientos (solo dueño).
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const idBodegaRaw = searchParams.get("id_bodega");
  const idProductoRaw = searchParams.get("id_producto");
  const tipoRaw = searchParams.get("tipo_movimiento");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const limitRaw = searchParams.get("limit");

  const idBodega = idBodegaRaw ? Number(idBodegaRaw) : null;
  const idProducto = idProductoRaw ? Number(idProductoRaw) : null;
  const tipoMov = tipoRaw && isTipoMov(tipoRaw) ? tipoRaw : null;

  const limit = Math.min(Math.max(Number(limitRaw || 200) || 200, 1), 500);

  if (idBodegaRaw && (!idBodega || idBodega < 1)) {
    return NextResponse.json({ error: "id_bodega inválido" }, { status: 400 });
  }
  if (idProductoRaw && (!idProducto || idProducto < 1)) {
    return NextResponse.json({ error: "id_producto inválido" }, { status: 400 });
  }
  if (tipoRaw && !tipoMov) {
    return NextResponse.json({ error: "tipo_movimiento inválido" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        k.id_kardex,
        k.fecha_movimiento,
        k.tipo_movimiento,
        k.cantidad,
        k.descripcion,
        k.id_bodega,
        b.nombre_bodega,
        k.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.unidad_medida
      FROM kardex k
      JOIN bodega b ON b.id_bodega = k.id_bodega
      JOIN producto p ON p.id_producto = k.id_producto
      WHERE ($1::int IS NULL OR k.id_bodega = $1)
        AND ($2::int IS NULL OR k.id_producto = $2)
        AND ($3::text IS NULL OR k.tipo_movimiento = $3)
        AND ($4::timestamp IS NULL OR k.fecha_movimiento >= $4::timestamp)
        AND ($5::timestamp IS NULL OR k.fecha_movimiento < ($5::date + INTERVAL '1 day'))
      ORDER BY k.fecha_movimiento DESC, k.id_kardex DESC
      LIMIT $6
      `,
      [idBodega, idProducto, tipoMov, desde, hasta, limit]
    );

    return NextResponse.json({ movimientos: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar kardex", detalle: String(error) },
      { status: 500 }
    );
  }
}
