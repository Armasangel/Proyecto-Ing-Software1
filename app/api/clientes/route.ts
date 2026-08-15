import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

// Esta ruta se consulta desde Ventas/Pedidos para saber si un cliente está
// bloqueado por deuda — nunca debe servirse cacheada (ni por el navegador ni
// por Next), o un colaborador podría ver la lista desactualizada.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  // ?todos=1 incluye también clientes bloqueados (estado_cliente = FALSE) y su
  // límite de deuda — lo usa la página de deudas para vincular/gestionar
  // clientes que ya están bloqueados. Las páginas de ventas/ordenes NO mandan
  // este parámetro, así que siguen viendo solo clientes activos como antes.
  const incluirTodos = req.nextUrl.searchParams.get("todos") === "1";

  try {
    const result = await pool.query(
      `SELECT id_cliente, nombre, correo, telefono, tipo_cliente, estado_cliente, limite_deuda
       FROM cliente
       ${incluirTodos ? "" : "WHERE estado_cliente = TRUE"}
       ORDER BY nombre`
    );
    return NextResponse.json(
      { clientes: result.rows },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    return apiError("CLIENTES GET", error);
  }
}

// POST /api/clientes — crea un cliente nuevo (ej. desde el flujo de "vincular
// a un cliente" en Deudas, cuando la persona todavía no está registrada).
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const { nombre, correo, telefono, tipo_cliente, limite_deuda } = await req.json();

  if (!nombre || !nombre.trim()) {
    return validationError("El nombre del cliente es obligatorio");
  }
  const tipoFinal = tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";

  let limiteNum: number | null = null;
  if (limite_deuda !== null && limite_deuda !== undefined && limite_deuda !== "") {
    limiteNum = Number(limite_deuda);
    if (!Number.isFinite(limiteNum) || limiteNum < 0) {
      return validationError("El límite de deuda debe ser un número mayor o igual a 0");
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO cliente (nombre, correo, telefono, tipo_cliente, limite_deuda)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_cliente, nombre, correo, telefono, tipo_cliente, estado_cliente, limite_deuda`,
      [nombre.trim(), correo || null, telefono || null, tipoFinal, limiteNum]
    );
    return NextResponse.json({ cliente: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      // uq_cliente_correo
      return validationError("Ya existe un cliente registrado con ese correo");
    }
    return apiError("CLIENTES POST", error);
  }
}