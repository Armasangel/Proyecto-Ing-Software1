import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  try {
    const result = await pool.query(`
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.precio_unitario,
        p.precio_mayoreo,
        p.unidad_medida,
        p.estado_producto,
        c.nombre_categoria,
        m.nombre_marca
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN marca     m ON m.id_marca     = p.id_marca
      ORDER BY p.nombre_producto
    `);
    return NextResponse.json({ productos: result.rows });
  } catch (error) {
    return apiError("PRODUCTOS GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  try {
    const body = await req.json();
    const {
      codigo_producto,
      nombre_producto,
      precio_unitario,
      precio_mayoreo,
      unidad_medida,
      estado_producto = true,
      caducidad = false,
      exento_iva = false,
      id_categoria,
      id_marca,
    } = body;

    if (!codigo_producto || !nombre_producto || !unidad_medida || !id_categoria || !id_marca) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO producto (
        codigo_producto, nombre_producto, precio_unitario, precio_mayoreo,
        unidad_medida, estado_producto, caducidad, exento_iva, id_categoria, id_marca
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id_producto`,
      [
        codigo_producto,
        nombre_producto,
        precio_unitario || null,
        precio_mayoreo || null,
        unidad_medida,
        estado_producto,
        caducidad,
        exento_iva,
        id_categoria,
        id_marca,
      ]
    );

    return NextResponse.json({ id_producto: result.rows[0].id_producto }, { status: 201 });
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "El código de producto ya existe" }, { status: 409 });
    }
    return apiError("PRODUCTOS POST", error);
  }
}