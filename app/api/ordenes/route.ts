import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/ordenes");

const ESTADOS_ORDEN = ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "ENVIADO", "ENTREGADO", "CANCELADO"] as const;

type LineaInput = {
  id_producto: number;
  // Presentación de mayoreo (ej. "Caja de 24") con la que el colaborador
  // capturó la línea, si aplica. Ya no se recibe id_bodega del cliente: la
  // bodega de origen se asigna automáticamente (ver POST más abajo).
  id_presentacion: number | null;
  // Cantidad tal como la capturó el colaborador: en unidades de la
  // presentación si id_presentacion viene, o en unidad base si no.
  cantidad: number;
  precio_unitario: number;
};

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  try {
    const estadoFilter = searchParams.get("estado");
    const estadoFiltrado = estadoFilter && ESTADOS_ORDEN.includes(estadoFilter as typeof ESTADOS_ORDEN[number]);

    const countResult = estadoFiltrado
      ? await pool.query(`SELECT COUNT(*)::int AS total FROM orden WHERE estado = $1`, [estadoFilter])
      : await pool.query(`SELECT COUNT(*)::int AS total FROM orden`);
    const total: number = countResult.rows[0]?.total ?? 0;

    let whereClause = "";
    const params: unknown[] = [limit, offset];
    if (estadoFiltrado) {
      whereClause = "WHERE o.estado = $3";
      params.push(estadoFilter);
    }

    const result = await pool.query(
      `
      SELECT
        o.id_orden,
        o.id_cliente,
        o.id_usuario,
        o.fecha_orden,
        o.estado,
        o.notas,
        o.total,
        o.id_venta,
        c.nombre AS nombre_cliente,
        c.correo AS correo_cliente,
        c.tipo_cliente,
        c.codigo_cliente,
        c.nit_cliente,
        c.direccion,
        u.nombre AS nombre_usuario,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', d.id_detalle,
              'id_producto', d.id_producto,
              'codigo_producto', p.codigo_producto,
              'nombre_producto', p.nombre_producto,
              'id_bodega', d.id_bodega,
              'nombre_bodega', b.nombre_bodega,
              'cantidad', d.cantidad,
              'unidad_medida', d.unidad_base,
              'precio_unitario', d.precio_unitario,
              'subtotal', d.subtotal,
              'id_presentacion', d.id_presentacion,
              'nombre_presentacion', pp.nombre_presentacion,
              'cantidad_presentacion', d.cantidad_presentacion
            )
            ORDER BY d.id_detalle
          ) FILTER (WHERE d.id_detalle IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM orden o
      JOIN cliente c ON c.id_cliente = o.id_cliente
      LEFT JOIN usuario u ON u.id_usuario = o.id_usuario
      LEFT JOIN detalle_orden d ON d.id_orden = o.id_orden
      LEFT JOIN producto p ON p.id_producto = d.id_producto
      LEFT JOIN bodega b ON b.id_bodega = d.id_bodega
      LEFT JOIN presentacion_producto pp ON pp.id_presentacion = d.id_presentacion
      ${whereClause}
      GROUP BY o.id_orden, o.id_cliente, o.id_usuario, o.fecha_orden,
        o.estado, o.notas, o.total, o.id_venta, c.nombre, c.correo, c.tipo_cliente,
        c.codigo_cliente, c.nit_cliente, c.direccion, u.nombre
      ORDER BY o.fecha_orden DESC
      LIMIT $1 OFFSET $2
      `,
      params
    );

    return NextResponse.json({
      ordenes: result.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    log.error({ err: error }, "Error al consultar ordenes [GET]");
    return NextResponse.json({ error: "Error al consultar ordenes" }, { status: 500 });
  }
}

// Las órdenes ya no se crean sueltas: una orden es el pedido de entrega de una
// VENTA a domicilio (que es la que descuenta stock, factura y, si es a crédito,
// genera la cuenta por cobrar). Se crean desde Ventas, eligiendo "A domicilio".
export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Las órdenes se generan desde Ventas: registra una venta con entrega a domicilio." },
    { status: 410 }
  );
}
