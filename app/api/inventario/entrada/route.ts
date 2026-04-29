import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await request.json();
    const { id_bodega, id_producto, cantidad, tipo_ingreso, descripcion } = body;

    if (!id_bodega || !id_producto || !cantidad || !tipo_ingreso) {
      return validationError("Faltan campos obligatorios: id_bodega, id_producto, cantidad, tipo_ingreso");
    }

    if (cantidad <= 0) {
      return validationError("La cantidad debe ser mayor a 0");
    }

    if (!["UNIDADES", "CAJAS"].includes(tipo_ingreso)) {
      return validationError("tipo_ingreso debe ser UNIDADES o CAJAS");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existe = await client.query(
        `SELECT 1 FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
        [id_bodega, id_producto]
      );

      if (existe.rowCount === 0) {
        await client.query(
          `INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
           VALUES ($1, $2, $3, 0)`,
          [id_bodega, id_producto, cantidad]
        );
      } else {
        await client.query(
          `UPDATE bodega_producto
           SET cantidad_disponible = cantidad_disponible + $1,
               ultima_actualizacion = NOW()
           WHERE id_bodega = $2 AND id_producto = $3`,
          [cantidad, id_bodega, id_producto]
        );
      }

      await client.query(
        `INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
         VALUES ($1, $2, 'ENTRADA', $3, $4)`,
        [
          id_bodega,
          id_producto,
          cantidad,
          descripcion || `Entrada por ${tipo_ingreso.toLowerCase()}`,
        ]
      );

      await client.query("COMMIT");

      const stockActualizado = await client.query(
        `SELECT
           bp.cantidad_disponible,
           bp.ultima_actualizacion,
           p.nombre_producto,
           p.unidad_medida,
           b.nombre_bodega
         FROM bodega_producto bp
         JOIN producto p ON p.id_producto = bp.id_producto
         JOIN bodega   b ON b.id_bodega   = bp.id_bodega
         WHERE bp.id_bodega = $1 AND bp.id_producto = $2`,
        [id_bodega, id_producto]
      );

      return NextResponse.json({
        mensaje: "Entrada de inventario registrada correctamente ✅",
        stock: stockActualizado.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return apiError("INVENTARIO ENTRADA POST", error);
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError("INVENTARIO ENTRADA POST - parse", error);
  }
}