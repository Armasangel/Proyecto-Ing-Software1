// app/api/facturacion/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.total,
        v.estado_venta,
        u.nombre,
        u.correo,
        f.id_factura,
        f.numero_factura,
        f.total_factura
      FROM venta v
      JOIN usuario u ON u.id_usuario = v.id_usuario
      LEFT JOIN factura f ON f.id_venta = v.id_venta
      ORDER BY v.fecha_venta DESC
    `);
    return NextResponse.json({ ventas: result.rows });
  } catch (error) {
    return apiError("FACTURACION GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return unauthorizedError();
  }

  try {
    const { id_venta, nombre_cliente, nit_cliente } = await req.json();

    if (!id_venta) {
      return validationError("id_venta es requerido");
    }

    const venta = await pool.query(
      `SELECT total FROM venta WHERE id_venta = $1`,
      [id_venta]
    );

    if (venta.rows.length === 0) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    const total = venta.rows[0].total;
    const numero_factura = `FACT-${Date.now()}`;

    const facturaResult = await pool.query(
      `INSERT INTO factura (id_venta, numero_factura, nombre_cliente, nit_cliente, total_factura)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_factura`,
      [id_venta, numero_factura, nombre_cliente || "Consumidor Final", nit_cliente || "CF", total]
    );

    await pool.query(
      `UPDATE venta SET estado_venta = 'CONFIRMADO' WHERE id_venta = $1`,
      [id_venta]
    );

    return NextResponse.json({
      ok: true,
      id_factura: facturaResult.rows[0].id_factura,
      numero_factura,
    });
  } catch (error) {
    return apiError("FACTURACION POST", error);
  }
}