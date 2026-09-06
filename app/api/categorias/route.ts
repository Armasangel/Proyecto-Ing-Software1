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
    const result = await pool.query(
      `SELECT id_categoria, nombre_categoria FROM categoria ORDER BY nombre_categoria`
    );
    return NextResponse.json({ categorias: result.rows });
  } catch (error) {
    return apiError("CATEGORIAS GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  try {
    const { nombre_categoria } = await req.json();
    if (!nombre_categoria || !String(nombre_categoria).trim()) {
      return NextResponse.json({ error: "El nombre de la categoría es obligatorio" }, { status: 400 });
    }
    const result = await pool.query(
      `INSERT INTO categoria (nombre_categoria) VALUES ($1) RETURNING id_categoria, nombre_categoria`,
      [String(nombre_categoria).trim()]
    );
    return NextResponse.json({ categoria: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
    }
    return apiError("CATEGORIAS POST", error);
  }
}