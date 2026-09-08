import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  const esBodeguero = !!usuario && isBodegueroTipo(usuario.tipo_usuario);
  if (!usuario || !(isStaffTipo(usuario.tipo_usuario) || esBodeguero)) {
    return unauthorizedError();
  }

  try {
    const body = await request.json();
    const { id_producto, tipo_ingreso, descripcion } = body;

    // El bodeguero solo puede operar sobre su propia bodega asignada; se
    // ignora cualquier id_bodega que venga en el body para ese rol.
    const id_bodega = esBodeguero ? usuario.id_bodega : body.id_bodega;
    if (esBodeguero && !id_bodega) {
      return unauthorizedError();
    }

    // Presentación opcional (ej. "Caja de 24"): si viene, la cantidad que
    // escribe la persona está en esa presentación y se convierte a la
    // unidad base del producto usando su factor_conversion. Si no viene,
    // se mantiene el comportamiento anterior (cantidad en unidad base).
    const idPresentacionRaw = body.id_presentacion;
    const cantidadPresentacionRaw = body.cantidad_presentacion;
    const usaPresentacion = idPresentacionRaw != null && cantidadPresentacionRaw != null;
    const cantidadIngresada = usaPresentacion ? Number(cantidadPresentacionRaw) : Number(body.cantidad);

    if (!id_bodega || !id_producto || !cantidadIngresada || (!usaPresentacion && !tipo_ingreso)) {
      return validationError("Faltan campos obligatorios: id_bodega, id_producto, cantidad, tipo_ingreso");
    }

    if (cantidadIngresada <= 0) {
      return validationError("La cantidad debe ser mayor a 0");
    }

    if (!usaPresentacion && !["UNIDADES", "CAJAS"].includes(tipo_ingreso)) {
      return validationError("tipo_ingreso debe ser UNIDADES o CAJAS");
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
        `INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion, id_usuario, id_presentacion, cantidad_presentacion)
         VALUES ($1, $2, 'ENTRADA', $3, $4, $5, $6, $7)`,
        [
          id_bodega,
          id_producto,
          cantidad,
          descripcion || (usaPresentacion ? "Entrada de bodega" : `Entrada por ${tipo_ingreso.toLowerCase()}`),
          usuario.id_usuario,
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
