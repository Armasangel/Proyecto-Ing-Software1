// app/api/bodegas/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idBodega = Number(params.id);
  if (!idBodega || idBodega < 1) {
    return NextResponse.json({ error: "ID de bodega inválido" }, { status: 400 });
  }

  try {
    const { nombre_bodega, ubicacion } = await req.json();

    if (!nombre_bodega || !String(nombre_bodega).trim()) {
      return NextResponse.json(
        { error: "El nombre de la bodega es obligatorio" },
        { status: 400 }
      );
    }

    const existe = await pool.query(
      `SELECT 1 FROM bodega WHERE id_bodega = $1`,
      [idBodega]
    );
    if (!existe.rowCount) {
      return NextResponse.json({ error: "Bodega no encontrada" }, { status: 404 });
    }

    const duplicado = await pool.query(
      `SELECT 1 FROM bodega WHERE LOWER(nombre_bodega) = LOWER($1) AND id_bodega != $2`,
      [String(nombre_bodega).trim(), idBodega]
    );
    if (duplicado.rowCount && duplicado.rowCount > 0) {
      return NextResponse.json(
        { error: "Ya existe una bodega con ese nombre" },
        { status: 409 }
      );
    }

    const result = await pool.query(
      `UPDATE bodega
       SET nombre_bodega = $1, ubicacion = $2
       WHERE id_bodega = $3
       RETURNING id_bodega, nombre_bodega, ubicacion`,
      [
        String(nombre_bodega).trim(),
        ubicacion ? String(ubicacion).trim() : null,
        idBodega,
      ]
    );

    return NextResponse.json({ bodega: result.rows[0] });
  } catch (error) {
    return apiError("BODEGAS PATCH", error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idBodega = Number(params.id);
  if (!idBodega || idBodega < 1) {
    return NextResponse.json({ error: "ID de bodega inválido" }, { status: 400 });
  }

  try {
    const existe = await pool.query(
      `SELECT id_bodega FROM bodega WHERE id_bodega = $1`,
      [idBodega]
    );
    if (!existe.rowCount) {
      return NextResponse.json({ error: "Bodega no encontrada" }, { status: 404 });
    }

    // Verificar que no tenga stock activo
    const conStock = await pool.query(
      `SELECT 1 FROM bodega_producto
       WHERE id_bodega = $1 AND cantidad_disponible > 0
       LIMIT 1`,
      [idBodega]
    );
    if (conStock.rowCount && conStock.rowCount > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar: la bodega tiene stock activo. Transfiere o ajusta el inventario primero.",
        },
        { status: 409 }
      );
    }

    // Verificar que no tenga ventas asociadas
    const conVentas = await pool.query(
      `SELECT 1 FROM venta WHERE id_bodega = $1 LIMIT 1`,
      [idBodega]
    );
    if (conVentas.rowCount && conVentas.rowCount > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: la bodega tiene ventas registradas." },
        { status: 409 }
      );
    }

    // Eliminar relaciones huérfanas (sin stock) y luego la bodega
    await pool.query(
      `DELETE FROM bodega_producto WHERE id_bodega = $1`,
      [idBodega]
    );
    await pool.query(`DELETE FROM bodega WHERE id_bodega = $1`, [idBodega]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("BODEGAS DELETE", error);
  }
}