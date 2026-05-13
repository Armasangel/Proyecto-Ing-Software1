// app/api/ventas/[id]/route.ts
// PATCH /api/ventas/[id] → cambia el estado de una venta
// DEV-23: lógica estado pedidos
// DEV-46: acceso solo colaborador

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isColaboradorTipo } from "@/lib/roles";

const ESTADOS_VALIDOS = ["PENDIENTE", "CONFIRMADO", "ENTREGADO", "PAGADO"] as const;
type EstadoVenta = (typeof ESTADOS_VALIDOS)[number];

function isEstadoValido(s: string): s is EstadoVenta {
  return (ESTADOS_VALIDOS as readonly string[]).includes(s);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // DEV-46: solo colaboradores autorizados
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isColaboradorTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id_venta = Number(params.id);
  if (!id_venta || id_venta < 1) {
    return NextResponse.json({ error: "ID de venta inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { estado_venta } = body;

    // DEV-23: validar que el estado sea válido
    if (typeof estado_venta !== "string" || !isEstadoValido(estado_venta)) {
      return NextResponse.json(
        {
          error: "estado_venta inválido. Use: PENDIENTE, CONFIRMADO, ENTREGADO o PAGADO",
        },
        { status: 400 }
      );
    }

    // Verificar que la venta existe
    const existe = await pool.query(
      `SELECT id_venta, estado_venta FROM venta WHERE id_venta = $1`,
      [id_venta]
    );

    if (existe.rowCount === 0) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    // Actualizar estado y registrar colaborador que hizo el cambio
    const result = await pool.query(
      `UPDATE venta
       SET estado_venta = $1,
           id_empleado  = $2
       WHERE id_venta = $3
       RETURNING id_venta, estado_venta`,
      [estado_venta, usuario.id_usuario, id_venta]
    );

    return NextResponse.json({
      mensaje: "Estado actualizado correctamente ✅",
      venta: result.rows[0],
    });
  } catch (error) {
    console.error("[VENTAS PATCH]", error);
    return NextResponse.json(
      { error: "Error al actualizar estado", detalle: String(error) },
      { status: 500 }
    );
  }
}