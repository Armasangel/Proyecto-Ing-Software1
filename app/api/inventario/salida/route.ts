import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

const MOTIVOS_VALIDOS = ["MERMA", "USO_INTERNO"] as const;

/**
 * POST /api/inventario/salida
 * Registra una salida manual de bodega (no generada por una venta), con un
 * motivo obligatorio: MERMA (daño/vencimiento) o USO_INTERNO. Para traslados
 * entre bodegas se usa /api/gestion-inventario/transferencia.
 */
export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  const esBodeguero = !!usuario && isBodegueroTipo(usuario.tipo_usuario);
  if (!usuario || !(isStaffTipo(usuario.tipo_usuario) || esBodeguero)) {
    return unauthorizedError();
  }

  try {
    const body = await request.json();
    const { id_producto, motivo, descripcion } = body;

    const id_bodega = esBodeguero ? usuario.id_bodega : body.id_bodega;
    if (esBodeguero && !id_bodega) {
      return unauthorizedError();
    }

    if (!MOTIVOS_VALIDOS.includes(motivo)) {
      return validationError(`motivo debe ser uno de: ${MOTIVOS_VALIDOS.join(", ")}`);
    }

    const idPresentacionRaw = body.id_presentacion;
    const cantidadPresentacionRaw = body.cantidad_presentacion;
    const usaPresentacion = idPresentacionRaw != null && cantidadPresentacionRaw != null;
    const cantidadIngresada = usaPresentacion ? Number(cantidadPresentacionRaw) : Number(body.cantidad);

    if (!id_bodega || !id_producto || !cantidadIngresada) {
      return validationError("Faltan campos obligatorios: id_bodega, id_producto, cantidad, motivo");
    }

    if (cantidadIngresada <= 0) {
      return validationError("La cantidad debe ser mayor a 0");
    }

    if (motivo === "USO_INTERNO" && !String(descripcion || "").trim()) {
      return validationError("La descripción es obligatoria para uso interno");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let cantidad = cantidadIngresada;
      let idPresentacion: number | null = null;
      let cantidadPresentacion: number | null = null;

      if (usaPresentacion) {
        const idPresentacionNum = Number(idPresentacionRaw);
        const presentacion = await client.query(
          `SELECT factor_conversion FROM presentacion_producto
           WHERE id_presentacion = $1 AND id_producto = $2 AND estado_presentacion = TRUE`,
          [idPresentacionNum, id_producto]
        );
        if (presentacion.rowCount === 0) {
          await client.query("ROLLBACK");
          return validationError("Presentación inválida para este producto");
        }
        const factor = Number(presentacion.rows[0].factor_conversion);
        cantidad = cantidadIngresada * factor;
        idPresentacion = idPresentacionNum;
        cantidadPresentacion = cantidadIngresada;
      }

      const stockActual = await client.query(
        `SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
        [id_bodega, id_producto]
      );
      const disponible =
        stockActual.rowCount && stockActual.rows[0] ? Number(stockActual.rows[0].cantidad_disponible) : 0;

      if (disponible < cantidad) {
        await client.query("ROLLBACK");
        return validationError(`Stock insuficiente en la bodega (disponible: ${disponible})`);
      }

      await client.query(
        `UPDATE bodega_producto
         SET cantidad_disponible = cantidad_disponible - $1,
             ultima_actualizacion = NOW()
         WHERE id_bodega = $2 AND id_producto = $3`,
        [cantidad, id_bodega, id_producto]
      );

      await client.query(
        `INSERT INTO kardex
           (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion, id_usuario, motivo, id_presentacion, cantidad_presentacion)
         VALUES ($1, $2, 'SALIDA', $3, $4, $5, $6, $7, $8)`,
        [
          id_bodega,
          id_producto,
          cantidad,
          descripcion || (motivo === "MERMA" ? "Merma / producto dañado" : "Uso interno"),
          usuario.id_usuario,
          motivo,
          idPresentacion,
          cantidadPresentacion,
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
        mensaje: "Salida de inventario registrada correctamente ✅",
        stock: stockActualizado.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return apiError("INVENTARIO SALIDA POST", error);
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError("INVENTARIO SALIDA POST - parse", error);
  }
}
