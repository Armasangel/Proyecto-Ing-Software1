import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";

const ESTADOS_ORDEN = ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "ENVIADO", "ENTREGADO", "CANCELADO"] as const;

type LineaInput = {
  id_producto: number;
  id_bodega: number | null;
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
  const estadoFilter = searchParams.get("estado");

  try {
    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM orden`);
    const total: number = countResult.rows[0]?.total ?? 0;

    let whereClause = "";
    const params: unknown[] = [limit, offset];
    if (estadoFilter && ESTADOS_ORDEN.includes(estadoFilter as typeof ESTADOS_ORDEN[number])) {
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
        c.nombre AS nombre_cliente,
        c.correo AS correo_cliente,
        c.tipo_cliente,
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
              'precio_unitario', d.precio_unitario,
              'subtotal', d.subtotal
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
      ${whereClause}
      GROUP BY o.id_orden, o.id_cliente, o.id_usuario, o.fecha_orden,
        o.estado, o.notas, o.total, c.nombre, c.correo, c.tipo_cliente, u.nombre
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
    console.error("[ORDENES GET]", error);
    return NextResponse.json({ error: "Error al consultar ordenes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id_cliente: idCliente, notas, lineas } = body;

    if (!idCliente || Number(idCliente) < 1) {
      return NextResponse.json({ error: "Debe seleccionar un cliente" }, { status: 400 });
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return NextResponse.json({ error: "Agregue al menos un producto a la orden" }, { status: 400 });
    }

    const lineasNorm: LineaInput[] = [];
    for (const L of lineas as unknown[]) {
      if (!L || typeof L !== "object") continue;
      const o = L as Record<string, unknown>;
      const id_producto = Number(o.id_producto);
      const id_bodega = o.id_bodega ? Number(o.id_bodega) : null;
      const cantidad = Number(o.cantidad);
      const precio_unitario = Number(o.precio_unitario);
      if (!id_producto || cantidad <= 0 || precio_unitario < 0) {
        return NextResponse.json(
          { error: "Cada linea requiere id_producto, cantidad > 0 y precio valido" },
          { status: 400 }
        );
      }
      lineasNorm.push({ id_producto, id_bodega, cantidad, precio_unitario });
    }

    if (lineasNorm.length === 0) {
      return NextResponse.json({ error: "Lineas de orden invalidas" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existeCliente = await client.query(
        `SELECT estado_cliente FROM cliente WHERE id_cliente = $1`,
        [idCliente]
      );
      if (existeCliente.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
      }
      if (existeCliente.rows[0].estado_cliente !== true) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Este cliente está bloqueado (superó su límite de deuda) y no puede hacer pedidos" },
          { status: 400 }
        );
      }

      let total = 0;
      const prepared: Array<{ id_producto: number; id_bodega: number | null; cantidad: number; precio: number; subtotal: number }> = [];

      for (const ln of lineasNorm) {
        const prod = await client.query(
          `SELECT id_producto, estado_producto FROM producto WHERE id_producto = $1`,
          [ln.id_producto]
        );
        if (prod.rowCount === 0 || !prod.rows[0].estado_producto) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: `Producto no disponible: id ${ln.id_producto}` }, { status: 400 });
        }

        if (ln.id_bodega) {
          const bod = await client.query(`SELECT 1 FROM bodega WHERE id_bodega = $1`, [ln.id_bodega]);
          if (bod.rowCount === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: `Bodega no encontrada: id ${ln.id_bodega}` }, { status: 400 });
          }
        }

        const subQ = await client.query(
          `SELECT ROUND(($1::numeric * $2::numeric), 2) AS sub`,
          [ln.cantidad, ln.precio_unitario]
        );
        const subtotal = Number(subQ.rows[0].sub);
        total += subtotal;
        prepared.push({ id_producto: ln.id_producto, id_bodega: ln.id_bodega, cantidad: ln.cantidad, precio: ln.precio_unitario, subtotal });
      }

      const totalQ = await client.query(`SELECT ROUND($1::numeric, 2) AS t`, [total]);
      total = Number(totalQ.rows[0].t);

      const insOrden = await client.query(
        `INSERT INTO orden (id_cliente, id_usuario, notas, total)
         VALUES ($1, $2, $3, $4) RETURNING id_orden`,
        [idCliente, usuario.id_usuario, notas || null, total]
      );
      const idOrden = insOrden.rows[0].id_orden as number;

      for (const p of prepared) {
        await client.query(
          `INSERT INTO detalle_orden (id_orden, id_producto, id_bodega, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [idOrden, p.id_producto, p.id_bodega, p.cantidad, p.precio, p.subtotal]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ mensaje: "Orden creada correctamente", id_orden: idOrden, total }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[ORDENES POST]", error);
      return NextResponse.json({ error: "Error al crear la orden" }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[ORDENES POST - parse]", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}