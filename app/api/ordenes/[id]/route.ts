import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";

const ESTADOS_ORDEN = ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "ENVIADO", "ENTREGADO", "CANCELADO"] as const;
type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

function isEstadoValido(s: string): s is EstadoOrden {
  return (ESTADOS_ORDEN as readonly string[]).includes(s);
}

// Transiciones que un BODEGUERO puede hacer desde el tablero "en vivo" de su
// bodega — solo avanzar el flujo de preparación, nunca cancelar ni tocar
// notas/cliente. Dueño y colaborador (isStaffTipo) siguen sin esta
// restricción.
const TRANSICIONES_BODEGUERO: Record<string, string[]> = {
  CONFIRMADO: ["EN_PREPARACION"],
  EN_PREPARACION: ["ENVIADO"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  const esStaff = !!usuario && isStaffTipo(usuario.tipo_usuario);
  const esBodeguero = !!usuario && isBodegueroTipo(usuario.tipo_usuario);
  if (!usuario || (!esStaff && !esBodeguero)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idOrden = Number(params.id);
  if (!idOrden || idOrden < 1) {
    return NextResponse.json({ error: "ID de orden invalido" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { estado, notas } = body;

    if (estado && !isEstadoValido(estado)) {
      return NextResponse.json(
        { error: `Estado invalido. Use: ${ESTADOS_ORDEN.join(", ")}` },
        { status: 400 }
      );
    }

    // El bodeguero solo puede cambiar estado (nunca notas) y solo dentro de
    // las transiciones de preparacion permitidas.
    if (esBodeguero && (notas !== undefined || !estado)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existe = await client.query(
        `SELECT id_orden, estado FROM orden WHERE id_orden = $1`,
        [idOrden]
      );
      if (existe.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
      }

      const estadoActual = existe.rows[0].estado as string;
      if (estadoActual === "CANCELADO" || estadoActual === "ENTREGADO") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `No se puede modificar una orden ${estadoActual.toLowerCase()}` },
          { status: 400 }
        );
      }

      if (esBodeguero) {
        const permitido = TRANSICIONES_BODEGUERO[estadoActual] ?? [];
        if (!permitido.includes(estado)) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Esa transicion de estado no esta permitida desde bodega" },
            { status: 400 }
          );
        }
        // Solo puede tocar ordenes que tengan al menos una linea asignada
        // a su propia bodega.
        const tieneLinea = await client.query(
          `SELECT 1 FROM detalle_orden WHERE id_orden = $1 AND id_bodega = $2 LIMIT 1`,
          [idOrden, usuario.id_bodega]
        );
        if (tieneLinea.rowCount === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (estado) {
        updates.push(`estado = $${idx++}`);
        values.push(estado);
      }
      if (notas !== undefined) {
        updates.push(`notas = $${idx++}`);
        values.push(notas || null);
      }

      if (updates.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
      }

      values.push(idOrden);
      await client.query(
        `UPDATE orden SET ${updates.join(", ")} WHERE id_orden = $${idx}`,
        values
      );

      await client.query("COMMIT");

      const updated = await client.query(
        `
        SELECT
          o.id_orden, o.id_cliente, o.id_usuario, o.fecha_orden,
          o.estado, o.notas, o.total,
          c.nombre AS nombre_cliente, c.correo AS correo_cliente,
          u.nombre AS nombre_usuario
        FROM orden o
        JOIN cliente c ON c.id_cliente = o.id_cliente
        LEFT JOIN usuario u ON u.id_usuario = o.id_usuario
        WHERE o.id_orden = $1
        `,
        [idOrden]
      );

      return NextResponse.json({ mensaje: "Orden actualizada", orden: updated.rows[0] ?? null });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[ORDENES PATCH]", error);
    return NextResponse.json({ error: "Error al actualizar la orden" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idOrden = Number(params.id);
  if (!idOrden || idOrden < 1) {
    return NextResponse.json({ error: "ID de orden invalido" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existe = await client.query(
        `SELECT id_orden, estado FROM orden WHERE id_orden = $1`,
        [idOrden]
      );
      if (existe.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
      }

      const estadoActual = existe.rows[0].estado as string;
      if (estadoActual === "ENTREGADO") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "No se puede cancelar una orden ya entregada" },
          { status: 400 }
        );
      }

      await client.query(
        `UPDATE orden SET estado = 'CANCELADO' WHERE id_orden = $1`,
        [idOrden]
      );

      await client.query("COMMIT");
      return NextResponse.json({ mensaje: "Orden cancelada" });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[ORDENES DELETE]", error);
    return NextResponse.json({ error: "Error al cancelar la orden" }, { status: 500 });
  }
}
