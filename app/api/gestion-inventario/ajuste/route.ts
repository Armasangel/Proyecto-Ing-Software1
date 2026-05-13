import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

type Body = {
  id_bodega: unknown;
  id_producto: unknown;
  nueva_cantidad: unknown;
  descripcion?: unknown;
};

/**
 * POST /api/gestion-inventario/ajuste
 * Ajuste de inventario a un stock objetivo (delta se registra como AJUSTE en kardex).
 */
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Body;
    const idBodega = Number(body.id_bodega);
    const idProducto = Number(body.id_producto);
    const nueva = Number(body.nueva_cantidad);
    const descripcion =
      typeof body.descripcion === "string" && body.descripcion.trim()
        ? body.descripcion.trim()
        : null;

    if (!idBodega || !idProducto) {
      return NextResponse.json({ error: "Faltan campos: id_bodega, id_producto" }, { status: 400 });
    }

    if (!Number.isFinite(nueva) || nueva < 0) {
      return NextResponse.json({ error: "nueva_cantidad inválida" }, { status: 400 });
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

      const stock = await client.query(
        `SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
        [idBodega, idProducto]
      );
      const anterior =
        stock.rowCount && stock.rows[0] ? Number(stock.rows[0].cantidad_disponible) : 0;
      const delta = nueva - anterior;

      if (delta === 0) {
        await client.query("COMMIT");
        return NextResponse.json({ mensaje: "Sin cambios", stock: { anterior, nueva } });
      }

      if (delta < 0 && anterior + delta < 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No hay stock suficiente para ese ajuste" }, { status: 400 });
      }

      if (stock.rowCount === 0) {
        await client.query(
          `
          INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
          VALUES ($1, $2, $3, 0)
          `,
          [idBodega, idProducto, nueva]
        );
      } else {
        await client.query(
          `
          UPDATE bodega_producto
          SET cantidad_disponible = $1,
              ultima_actualizacion = NOW()
          WHERE id_bodega = $2 AND id_producto = $3
          `,
          [nueva, idBodega, idProducto]
        );
      }

      const abs = Math.abs(delta);
      const descBase =
        descripcion ??
        `Ajuste manual (antes: ${anterior.toFixed(3)} → después: ${nueva.toFixed(3)})`;

      await client.query(
        `
        INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
        VALUES ($1, $2, 'AJUSTE', $3, $4)
        `,
        [idBodega, idProducto, abs, `${descBase} (delta ${delta > 0 ? "+" : "-"}${abs.toFixed(3)})`]
      );

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
          bp.ultima_actualizacion
        FROM bodega_producto bp
        JOIN bodega b ON b.id_bodega = bp.id_bodega
        JOIN producto p ON p.id_producto = bp.id_producto
        WHERE bp.id_bodega = $1 AND bp.id_producto = $2
        `,
        [idBodega, idProducto]
      );

      return NextResponse.json({
        mensaje: "Ajuste aplicado",
        delta,
        stock: updated.rows[0] ?? null,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error al ajustar inventario", detalle: String(error) },
      { status: 500 }
    );
  }
}
