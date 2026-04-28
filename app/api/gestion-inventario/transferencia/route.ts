import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

type Body = {
  id_bodega_origen: unknown;
  id_bodega_destino: unknown;
  id_producto: unknown;
  cantidad: unknown;
  descripcion?: unknown;
};

/**
 * POST /api/gestion-inventario/transferencia
 * Mueve stock entre bodegas y deja trazabilidad en kardex (SALIDA origen + ENTRADA destino).
 */
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Body;
    const idOrigen = Number(body.id_bodega_origen);
    const idDestino = Number(body.id_bodega_destino);
    const idProducto = Number(body.id_producto);
    const cantidad = Number(body.cantidad);
    const descripcion =
      typeof body.descripcion === "string" && body.descripcion.trim()
        ? body.descripcion.trim()
        : null;

    if (!idOrigen || !idDestino || !idProducto || !cantidad) {
      return NextResponse.json(
        { error: "Faltan campos: id_bodega_origen, id_bodega_destino, id_producto, cantidad" },
        { status: 400 }
      );
    }

    if (idOrigen === idDestino) {
      return NextResponse.json({ error: "La bodega origen y destino deben ser distintas" }, { status: 400 });
    }

    if (!(cantidad > 0)) {
      return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const prod = await client.query(
        `SELECT id_producto, estado_producto FROM producto WHERE id_producto = $1`,
        [idProducto]
      );
      if (prod.rowCount === 0 || !prod.rows[0].estado_producto) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
      }

      const bodegas = await client.query(`SELECT id_bodega FROM bodega WHERE id_bodega IN ($1, $2)`, [
        idOrigen,
        idDestino,
      ]);
      if (bodegas.rowCount !== 2) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Bodega origen/destino no encontrada" }, { status: 400 });
      }

      const stockOrigen = await client.query(
        `SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
        [idOrigen, idProducto]
      );
      const disponibleOrigen =
        stockOrigen.rowCount && stockOrigen.rows[0] ? Number(stockOrigen.rows[0].cantidad_disponible) : 0;
      if (disponibleOrigen < cantidad) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Stock insuficiente en bodega origen (disponible: ${disponibleOrigen})` },
          { status: 400 }
        );
      }

      await client.query(
        `
        UPDATE bodega_producto
        SET cantidad_disponible = cantidad_disponible - $1,
            ultima_actualizacion = NOW()
        WHERE id_bodega = $2 AND id_producto = $3
        `,
        [cantidad, idOrigen, idProducto]
      );

      const existeDest = await client.query(
        `SELECT 1 FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
        [idDestino, idProducto]
      );
      if (existeDest.rowCount === 0) {
        await client.query(
          `
          INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
          VALUES ($1, $2, $3, 0)
          `,
          [idDestino, idProducto, cantidad]
        );
      } else {
        await client.query(
          `
          UPDATE bodega_producto
          SET cantidad_disponible = cantidad_disponible + $1,
              ultima_actualizacion = NOW()
          WHERE id_bodega = $2 AND id_producto = $3
          `,
          [cantidad, idDestino, idProducto]
        );
      }

      const descBase = descripcion ?? "Transferencia entre bodegas";
      await client.query(
        `
        INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
        VALUES ($1, $2, 'SALIDA', $3, $4)
        `,
        [idOrigen, idProducto, cantidad, `${descBase} → bodega ${idDestino}`]
      );
      await client.query(
        `
        INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
        VALUES ($1, $2, 'ENTRADA', $3, $4)
        `,
        [idDestino, idProducto, cantidad, `${descBase} ← bodega ${idOrigen}`]
      );

      await client.query("COMMIT");

      const updated = await pool.query(
        `
        SELECT
          o.id_bodega AS id_bodega_origen,
          bo.nombre_bodega AS nombre_bodega_origen,
          d.id_bodega AS id_bodega_destino,
          bd.nombre_bodega AS nombre_bodega_destino,
          o.cantidad_disponible AS stock_origen,
          d.cantidad_disponible AS stock_destino,
          p.nombre_producto,
          p.unidad_medida
        FROM bodega_producto o
        JOIN bodega bo ON bo.id_bodega = o.id_bodega
        JOIN bodega_producto d ON d.id_bodega = $2 AND d.id_producto = o.id_producto
        JOIN bodega bd ON bd.id_bodega = d.id_bodega
        JOIN producto p ON p.id_producto = o.id_producto
        WHERE o.id_bodega = $1 AND o.id_producto = $3
        `,
        [idOrigen, idDestino, idProducto]
      );

      return NextResponse.json({
        mensaje: "Transferencia registrada",
        resultado: updated.rows[0] ?? null,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error al transferir inventario", detalle: String(error) },
      { status: 500 }
    );
  }
}
