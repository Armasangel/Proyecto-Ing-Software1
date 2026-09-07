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
      `SELECT id_marca, nombre_marca FROM marca ORDER BY nombre_marca`
    );
    return NextResponse.json({ marcas: result.rows });
  } catch (error) {
    return apiError("MARCAS GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  try {
    const { nombre_marca } = await req.json();
    if (!nombre_marca || !String(nombre_marca).trim()) {
      return NextResponse.json({ error: "El nombre de la marca es obligatorio" }, { status: 400 });
    }
    const result = await pool.query(
      `INSERT INTO marca (nombre_marca) VALUES ($1) RETURNING id_marca, nombre_marca`,
      [String(nombre_marca).trim()]
    );
    return NextResponse.json({ marca: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe una marca con ese nombre" }, { status: 409 });
    }
    return apiError("MARCAS POST", error);
  }
}