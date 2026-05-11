// app/api/pedidos/mayorista/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

// GET — detalle de un pedido específico (sin cambios)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR_MAYOR) {
    return unauthorizedError();
  }

  const idVenta = Number(params.id);
  if (!idVenta || idVenta < 1) return validationError("ID de pedido inválido");

  try {
    const result = await pool.query(
      `
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.total,
        v.fecha_limite_pago,
        ue.nombre AS nombre_colaborador,
        f.numero_factura,
        f.id_factura,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle',            dv.id_detalle_venta,
              'id_producto',           dv.id_producto,
              'codigo_producto',       p.codigo_producto,
              'nombre_producto',       p.nombre_producto,
              'unidad_medida',         p.unidad_medida,
              'cantidad',              dv.cantidad,
              'precio_unitario_venta', dv.precio_unitario,
              'subtotal',              dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      LEFT JOIN usuario       ue ON ue.id_usuario = v.id_empleado
      LEFT JOIN detalle_venta dv ON dv.id_venta   = v.id_venta
      LEFT JOIN producto       p ON p.id_producto  = dv.id_producto
      LEFT JOIN factura         f ON f.id_venta    = v.id_venta
      WHERE v.id_venta = $1
        AND v.id_usuario = $2
        AND v.tipo_venta = 'MAYORISTA'
      GROUP BY
        v.id_venta, v.fecha_venta, v.estado_venta, v.tipo_entrega,
        v.direccion_entrega, v.total, v.fecha_limite_pago,
        ue.nombre, f.numero_factura, f.id_factura
      `,
      [idVenta, usuario.id_usuario]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ pedido: result.rows[0] });
  } catch (error) {
    return apiError("PEDIDOS MAYORISTA [id] GET", error);
  }
}

// PATCH — cancelar pedido (solo si está en PENDIENTE)
//
// BUG FIX: antes se buscaba la bodega con un JOIN al kardex usando
// LIKE 'Pedido mayorista #N%', lo que era frágil: cualquier movimiento
// manual con texto similar podía producir filas duplicadas y restaurar
// stock incorrectamente o lanzar errores de constraint.
//
// Solución: leer id_bodega directamente de la tabla venta (columna
// añadida en migration_add_id_bodega_to_venta.sql). Si por algún motivo
// el campo es NULL (pedido creado antes de la migración), devolvemos
// un error claro en lugar de operar sobre datos incorrectos.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR_MAYOR) {
    return unauthorizedError();
  }

  const idVenta = Number(params.id);
  if (!idVenta || idVenta < 1) return validationError("ID de pedido inválido");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar que el pedido pertenece al usuario, está PENDIENTE
    // y tiene id_bodega registrado (columna añadida en migración)
    const ventaQ = await client.query(
      `SELECT id_venta, estado_venta, id_bodega
       FROM venta
       WHERE id_venta = $1
         AND id_usuario = $2
         AND tipo_venta = 'MAYORISTA'
       FOR UPDATE`,
      [idVenta, usuario.id_usuario]
    );

    if (ventaQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const venta = ventaQ.rows[0];

    if (venta.estado_venta !== "PENDIENTE") {
      await client.query("ROLLBACK");
      return validationError(
        `Solo se pueden cancelar pedidos en estado PENDIENTE. Estado actual: ${venta.estado_venta}`
      );
    }

    // BUG FIX: usar id_bodega guardado en la venta, no inferirlo del kardex
    const idBodega: number | null = venta.id_bodega;
    if (!idBodega) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "Este pedido no tiene bodega registrada (fue creado antes de la migración). " +
            "Contacta al administrador para cancelarlo manualmente.",
        },
        { status: 422 }
      );
    }

    // Obtener líneas del pedido para revertir el stock
    const detallesQ = await client.query(
      `SELECT id_producto, cantidad FROM detalle_venta WHERE id_venta = $1`,
      [idVenta]
    );

    // Revertir stock y registrar entrada en kardex por cada línea
    for (const row of detallesQ.rows) {
      await client.query(
        `UPDATE bodega_producto
         SET cantidad_disponible = cantidad_disponible + $1,
             ultima_actualizacion = NOW()
         WHERE id_bodega = $2 AND id_producto = $3`,
        [row.cantidad, idBodega, row.id_producto]
      );

      await client.query(
        `INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
         VALUES ($1, $2, 'AJUSTE', $3, $4)`,
        [
          idBodega,
          row.id_producto,
          row.cantidad,
          `Cancelación pedido mayorista #${idVenta}`,
        ]
      );
    }

    // Actualizar estado a CANCELADO
    await client.query(
      `UPDATE venta SET estado_venta = 'CANCELADO' WHERE id_venta = $1`,
      [idVenta]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      mensaje: `Pedido #${idVenta} cancelado. El stock fue devuelto a bodega.`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return apiError("PEDIDOS MAYORISTA [id] PATCH", error);
  } finally {
    client.release();
  }
}