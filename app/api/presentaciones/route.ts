import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

/**
 * GET /api/presentaciones?id_producto=123
 * Lista las presentaciones activas de un producto (ej. "Caja de 24").
 * Lectura disponible para dueño y bodeguero (la necesitan al registrar
 * entradas/salidas); la administración (crear/eliminar) es solo del dueño.
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !(isDuenoTipo(usuario.tipo_usuario) || isBodegueroTipo(usuario.tipo_usuario))) {
    return unauthorizedError();
  }

  const idProducto = Number(req.nextUrl.searchParams.get("id_producto"));
  if (!idProducto) {
    return validationError("id_producto es obligatorio");
  }

  try {
    const result = await pool.query(
      `SELECT id_presentacion, id_producto, nombre_presentacion, factor_conversion
       FROM presentacion_producto
       WHERE id_producto = $1 AND estado_presentacion = TRUE
       ORDER BY factor_conversion`,
      [idProducto]
    );
    return NextResponse.json({ presentaciones: result.rows });
  } catch (error) {
    return apiError("PRESENTACIONES GET", error);
  }
}

/**
 * POST /api/presentaciones
 * Crea una presentación nueva para un producto. Solo el dueño administra
 * el catálogo de presentaciones.
 */
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const idProducto = Number(body.id_producto);
    const nombre = typeof body.nombre_presentacion === "string" ? body.nombre_presentacion.trim() : "";
    const factor = Number(body.factor_conversion);

    if (!idProducto || !nombre) {
      return validationError("id_producto y nombre_presentacion son obligatorios");
    }
    if (!(factor > 0)) {
      return validationError("factor_conversion debe ser un número mayor a 0");
    }

    const producto = await pool.query(`SELECT 1 FROM producto WHERE id_producto = $1`, [idProducto]);
    if (producto.rowCount === 0) {
      return validationError("Producto no encontrado");
    }

    const existe = await pool.query(
      `SELECT 1 FROM presentacion_producto WHERE id_producto = $1 AND LOWER(nombre_presentacion) = LOWER($2)`,
      [idProducto, nombre]
    );
    if (existe.rowCount && existe.rowCount > 0) {
      return NextResponse.json(
        { error: "Ya existe una presentación con ese nombre para este producto" },
        { status: 409 }
      );
    }

    const result = await pool.query(
      `INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion)
       VALUES ($1, $2, $3)
       RETURNING id_presentacion, id_producto, nombre_presentacion, factor_conversion`,
      [idProducto, nombre, factor]
    );

    return NextResponse.json({ presentacion: result.rows[0] }, { status: 201 });
  } catch (error) {
    return apiError("PRESENTACIONES POST", error);
  }
}
