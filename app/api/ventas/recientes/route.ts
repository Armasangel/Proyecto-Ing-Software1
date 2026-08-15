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
      JOIN cliente u ON u.id_cliente = v.id_cliente
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

    // FIX: el número de factura ahora lo genera Postgres con nextval() de
    // una secuencia, DENTRO del mismo INSERT — así es atómico (Postgres
    // garantiza que nextval() nunca repite un valor, aunque dos facturas
    // se estén creando al mismo tiempo) y queda como correlativo real
    // (FACT-000001, FACT-000002, ...) en vez de un timestamp.
    const facturaResult = await pool.query(
      `INSERT INTO factura (id_venta, numero_factura, nombre_cliente, nit_cliente, total_factura)
       VALUES ($1, 'FACT-' || LPAD(nextval('factura_numero_seq')::text, 6, '0'), $2, $3, $4)
       RETURNING id_factura, numero_factura`,
      [id_venta, nombre_cliente || "Consumidor Final", nit_cliente || "CF", total]
    );

    await pool.query(
      `UPDATE venta SET estado_venta = 'CONFIRMADO' WHERE id_venta = $1`,
      [id_venta]
    );

    return NextResponse.json({
      ok: true,
      id_factura: facturaResult.rows[0].id_factura,
      numero_factura: facturaResult.rows[0].numero_factura,
    });
  } catch (error) {
    return apiError("FACTURACION POST", error);
  }
}