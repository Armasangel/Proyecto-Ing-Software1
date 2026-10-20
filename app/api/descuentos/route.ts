import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { validarDescuento, validarAsignacion, isTipoDescuento } from "@/lib/descuentos";

const log = getLogger("api/descuentos");

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type TramoInput = { cantidad_desde: unknown; porcentaje: unknown };

/**
 * GET /api/descuentos — lista todas las reglas con sus tramos y asignaciones.
 * Solo el dueño puede configurar descuentos.
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const reglasRes = await pool.query(
      `SELECT id_descuento, nombre, tipo, activo, creado_en, actualizado_en
         FROM descuento ORDER BY nombre`
    );
    const reglas = reglasRes.rows as Array<{ id_descuento: number }>;
    if (reglas.length === 0) {
      return NextResponse.json({ descuentos: [] }, { headers: { "Cache-Control": "no-store" } });
    }
    const ids = reglas.map((r) => r.id_descuento);

    const tramosRes = await pool.query(
      `SELECT id_tramo, id_descuento, cantidad_desde, porcentaje
         FROM descuento_tramo WHERE id_descuento = ANY($1)
        ORDER BY id_descuento, cantidad_desde`,
      [ids]
    );
    const asignacionesRes = await pool.query(
      `SELECT a.id_asignacion, a.id_descuento, a.id_cliente, a.tipo_cliente, c.nombre AS nombre_cliente
         FROM descuento_asignacion a
         LEFT JOIN cliente c ON c.id_cliente = a.id_cliente
        WHERE a.id_descuento = ANY($1)
        ORDER BY a.id_descuento`,
      [ids]
    );

    const tramos = tramosRes.rows as Array<{ id_descuento: number }>;
    const asignaciones = asignacionesRes.rows as Array<{ id_descuento: number }>;

    const descuentos = reglas.map((r) => ({
      ...r,
      tramos: tramos.filter((t) => t.id_descuento === r.id_descuento),
      asignaciones: asignaciones.filter((a) => a.id_descuento === r.id_descuento),
    }));

    return NextResponse.json({ descuentos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError("DESCUENTOS GET", error);
  }
}

/**
 * POST /api/descuentos — crea una regla con sus tramos. El body admite
 * opcionalmente asignaciones iniciales: [{ id_cliente } | { tipo_cliente }].
 */
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const { nombre, tipo, tramos, asignaciones } = body as {
      nombre?: unknown;
      tipo?: unknown;
      tramos?: TramoInput[];
      asignaciones?: Array<{ id_cliente?: unknown; tipo_cliente?: unknown }>;
    };

    const errorVal = validarDescuento(nombre, tipo, tramos);
    if (errorVal) return validationError(errorVal);
    const tipoFinal = isTipoDescuento(tipo) ? tipo : "PORCENTAJE";

    if (asignaciones !== undefined) {
      if (!Array.isArray(asignaciones)) return validationError("asignaciones debe ser una lista");
      for (const a of asignaciones) {
        const err = validarAsignacion(a?.id_cliente ?? null, a?.tipo_cliente ?? null);
        if (err) return validationError(err);
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO descuento (nombre, tipo, activo) VALUES ($1, $2, TRUE) RETURNING id_descuento`,
        [(nombre as string).trim(), tipoFinal]
      );
      const idDescuento = ins.rows[0].id_descuento as number;

      for (const t of tramos!) {
        await client.query(
          `INSERT INTO descuento_tramo (id_descuento, cantidad_desde, porcentaje) VALUES ($1, $2, $3)`,
          [idDescuento, Number(t.cantidad_desde), Number(t.porcentaje)]
        );
      }
      for (const a of asignaciones ?? []) {
        await client.query(
          `INSERT INTO descuento_asignacion (id_descuento, id_cliente, tipo_cliente) VALUES ($1, $2, $3)`,
          [
            idDescuento,
            a.id_cliente != null && String(a.id_cliente).trim() !== "" ? Number(a.id_cliente) : null,
            a.tipo_cliente != null && String(a.tipo_cliente).trim() !== "" ? a.tipo_cliente : null,
          ]
        );
      }
      await client.query("COMMIT");
      log.info({ id_descuento: idDescuento, usuario: usuario.id_usuario }, "Descuento creado");
      return NextResponse.json({ id_descuento: idDescuento }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error?.code === "23505") {
      return validationError("Ya existe un descuento con ese nombre");
    }
    return apiError("DESCUENTOS POST", error);
  }
}
