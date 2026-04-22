// app/api/ventas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.total,
        v.estado_venta,
        u.nombre,
        u.correo
      FROM venta v
      JOIN usuario u ON u.id_usuario = v.id_usuario
      ORDER BY v.fecha_venta DESC
    `);
    return NextResponse.json({ ventas: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar ventas", detalle: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
    }

    const total = items.reduce(
      (acc: number, item: { precio: number; cantidad: number }) =>
        acc + item.precio * item.cantidad,
      0
    );

    const ventaResult = await pool.query(
      `INSERT INTO venta (id_usuario, fecha_venta, total, estado_venta, tipo_venta, tipo_entrega, enlinea)
       VALUES ($1, NOW(), $2, 'PENDIENTE', 'MINORISTA', 'EN_TIENDA', true) RETURNING id_venta`,
      [usuario.id_usuario, total]
    );

    const id_venta = ventaResult.rows[0].id_venta;

    for (const item of items) {
      await pool.query(
        `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [id_venta, item.id_producto, item.cantidad, item.precio, item.precio * item.cantidad]
      );
    }

    return NextResponse.json({ ok: true, id_venta });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al registrar venta", detalle: String(error) },
      { status: 500 }
    );
  }
}