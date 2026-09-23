// app/api/facturacion/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const id_venta = Number(params.id);
  if (!Number.isInteger(id_venta) || id_venta <= 0) {
    return validationError("id_venta inválido");
  }

  try {
    const result = await pool.query(
      `
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.total,
        v.estado_venta,
        u.nombre,
        u.correo,
        f.id_factura,
        f.numero_factura,
        f.nombre_cliente,
        f.nit_cliente,
        f.total_factura,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', dv.id_detalle_venta,
              'codigo_producto', p.codigo_producto,
              'nombre_producto', p.nombre_producto,
              'cantidad', dv.cantidad,
              'precio_unitario', dv.precio_unitario,
              'subtotal', dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      JOIN cliente u ON u.id_cliente = v.id_cliente
      LEFT JOIN factura f ON f.id_venta = v.id_venta
      LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      LEFT JOIN producto p ON p.id_producto = dv.id_producto
      WHERE v.id_venta = $1
      GROUP BY
        v.id_venta, v.fecha_venta, v.total, v.estado_venta,
        u.nombre, u.correo,
        f.id_factura, f.numero_factura, f.nombre_cliente, f.nit_cliente, f.total_factura
      `,
      [id_venta]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ factura: result.rows[0] });
  } catch (error) {
    return apiError("FACTURACION [id] GET", error);
  }
}
