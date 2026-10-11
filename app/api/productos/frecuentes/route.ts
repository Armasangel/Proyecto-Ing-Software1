import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const LIMITE_POR_DEFECTO = 8;
const LIMITE_MAXIMO = 30;
const VENTANA_DIAS = 90;

/**
 * GET /api/productos/frecuentes?limit=8&con_stock=1
 * Productos activos más vendidos/pedidos en los últimos 90 días (unidades en
 * ventas y órdenes no canceladas). Para un bodeguero cuenta solo lo que salió
 * de SU bodega; para el resto cuenta toda la tienda.
 *
 * con_stock=1 deja solo los que tienen existencias en la bodega del bodeguero
 * (útil en Salida y Traslado, donde no se puede sacar lo que no hay).
 * Sirve de sugerencia en los selectores de producto antes de escribir nada.
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  const esBodeguero = !!usuario && isBodegueroTipo(usuario.tipo_usuario);
  if (!usuario || !(isStaffTipo(usuario.tipo_usuario) || esBodeguero)) {
    return unauthorizedError();
  }

  const sp = req.nextUrl.searchParams;
  const limiteParam = Number(sp.get("limit"));
  const limite =
    Number.isInteger(limiteParam) && limiteParam >= 1
      ? Math.min(limiteParam, LIMITE_MAXIMO)
      : LIMITE_POR_DEFECTO;

  const idBodega: number | null = esBodeguero && usuario.id_bodega ? Number(usuario.id_bodega) : null;
  const soloConStock = sp.get("con_stock") === "1" && idBodega !== null;

  try {
    const result = await pool.query(
      `WITH popularidad AS (
         SELECT id_producto, SUM(cantidad) AS unidades
           FROM (
             SELECT dv.id_producto, dv.cantidad
               FROM detalle_venta dv
               JOIN venta v ON v.id_venta = dv.id_venta
              WHERE v.estado_venta <> 'CANCELADO'
                AND v.fecha_venta >= NOW() - ($3::int * INTERVAL '1 day')
                AND ($1::int IS NULL OR dv.id_bodega = $1)
             UNION ALL
             SELECT d.id_producto, d.cantidad
               FROM detalle_orden d
               JOIN orden o ON o.id_orden = d.id_orden
              WHERE o.estado <> 'CANCELADO'
                AND o.fecha_orden >= NOW() - ($3::int * INTERVAL '1 day')
                AND ($1::int IS NULL OR d.id_bodega = $1)
           ) movimientos
          GROUP BY id_producto
       )
       SELECT p.id_producto, p.nombre_producto, p.codigo_producto, p.unidad_medida,
              COALESCE(pop.unidades, 0)::float AS unidades_recientes
         FROM producto p
         LEFT JOIN popularidad pop ON pop.id_producto = p.id_producto
        WHERE p.estado_producto = TRUE
          AND ($4::boolean = FALSE OR EXISTS (
                SELECT 1 FROM bodega_producto bp
                 WHERE bp.id_producto = p.id_producto
                   AND bp.id_bodega = $1
                   AND bp.cantidad_disponible > 0))
        ORDER BY unidades_recientes DESC, p.nombre_producto
        LIMIT $2`,
      [idBodega, limite, VENTANA_DIAS, soloConStock]
    );
    return NextResponse.json({ productos: result.rows });
  } catch (error) {
    return apiError("PRODUCTOS FRECUENTES GET", error);
  }
}
