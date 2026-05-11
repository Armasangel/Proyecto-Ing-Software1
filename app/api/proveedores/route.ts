import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

function esDueno(usuario: { tipo_usuario: string } | null) {
  return usuario?.tipo_usuario === TIPOS_USUARIO.DUENO;
}

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!esDueno(usuario)) return unauthorizedError();

  try {
    const result = await pool.query(
      `SELECT id_proveedor, nombre_proveedor, nit_proveedor,
              correo_contacto, telefono, estado_proveedor
       FROM proveedor
       ORDER BY nombre_proveedor`
    );
    return NextResponse.json({ proveedores: result.rows });
  } catch (error) {
    return apiError("PROVEEDORES GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!esDueno(usuario)) return unauthorizedError();

  try {
    const { nombre_proveedor, nit_proveedor, correo_contacto, telefono } =
      await req.json();

    if (!nombre_proveedor || !nit_proveedor) {
      return NextResponse.json(
        { error: "Nombre y NIT son obligatorios" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO proveedor (nombre_proveedor, nit_proveedor, correo_contacto, telefono)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre_proveedor, nit_proveedor, correo_contacto || null, telefono || null]
    );
    return NextResponse.json({ proveedor: result.rows[0] }, { status: 201 });
  } catch (error) {
    return apiError("PROVEEDORES POST", error);
  }
}

export async function PATCH(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!esDueno(usuario)) return unauthorizedError();

  try {
    const { id_proveedor, nombre_proveedor, nit_proveedor, correo_contacto, telefono } =
      await req.json();

    await pool.query(
      `UPDATE proveedor
       SET nombre_proveedor = $1,
           nit_proveedor    = $2,
           correo_contacto  = $3,
           telefono         = $4
       WHERE id_proveedor = $5`,
      [nombre_proveedor, nit_proveedor, correo_contacto || null, telefono || null, id_proveedor]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("PROVEEDORES PATCH", error);
  }
}

export async function DELETE(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!esDueno(usuario)) return unauthorizedError();

  try {
    const { id_proveedor } = await req.json();
    await pool.query(
      `UPDATE proveedor SET estado_proveedor = FALSE WHERE id_proveedor = $1`,
      [id_proveedor]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("PROVEEDORES DELETE", error);
  }
}