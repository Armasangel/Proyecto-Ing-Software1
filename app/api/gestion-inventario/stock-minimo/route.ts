import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

type Body = {
  id_bodega: unknown;
  id_producto: unknown;
  stock_minimo: unknown;
};

/**
 * PATCH /api/gestion-inventario/stock-minimo
 * Define alerta de stock mínimo por combinación bodega+producto (solo dueño).
 */
export async function PATCH(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Body;
    const idBodega = Number(body.id_bodega);
    const idProducto = Number(body.id_producto);
    const minimo = Number(body.stock_minimo);

    if (!idBodega || !idProducto) {
      return NextResponse.json({ error: "Faltan campos: id_bodega, id_producto" }, { status: 400 });
    }

    if (!Number.isFinite(minimo) || minimo < 0) {
      return NextResponse.json({ error: "stock_minimo inválido" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const prod = await client.query(`SELECT id_producto FROM producto WHERE id_producto = $1`, [idProducto]);
      if (prod.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 400 });
      }

      const bod = await client.query(`SELECT id_bodega FROM bodega WHERE id_bodega = $1`, [idBodega]);
      if (bod.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Bodega no encontrada" }, { status: 400 });
      }

      const existe = await client.query(
        `SELECT 1 FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
        [idBodega, idProducto]
      );

      if (existe.rowCount === 0) {
        await client.query(
          `
          INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
          VALUES ($1, $2, 0, $3)
          `,
          [idBodega, idProducto, minimo]
        );
      } else {
        await client.query(
          `
          UPDATE bodega_producto
          SET stock_minimo = $1,
              ultima_actualizacion = NOW()
          WHERE id_bodega = $2 AND id_producto = $3
          `,
          [minimo, idBodega, idProducto]
        );
      }

      await client.query("COMMIT");

      const updated = await pool.query(
        `
        SELECT
          bp.id_bodega,
          b.nombre_bodega,
          bp.id_producto,
          p.codigo_producto,
          p.nombre_producto,
          p.unidad_medida,
          bp.cantidad_disponible,
          bp.stock_minimo,
          (bp.cantidad_disponible < bp.stock_minimo) AS bajo_minimo,
          bp.ultima_actualizacion
        FROM bodega_producto bp
        JOIN bodega b ON b.id_bodega = bp.id_bodega
        JOIN producto p ON p.id_producto = bp.id_producto
        WHERE bp.id_bodega = $1 AND bp.id_producto = $2
        `,
        [idBodega, idProducto]
      );

      return NextResponse.json({ mensaje: "Stock mínimo actualizado", stock: updated.rows[0] ?? null });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar stock mínimo", detalle: String(error) },
      { status: 500 }
    );
  }
}
