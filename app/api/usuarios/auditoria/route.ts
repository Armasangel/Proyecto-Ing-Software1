// app/api/usuarios/auditoria/route.ts
//
// Lectura de la bitácora de credenciales. Sólo para el dueño.
//
// Filtros: `?q=` busca por correo, `?tipo=` por tipo de evento,
// `?pagina=` y `?por_pagina=` para paginar.
//
// Se pagina en la base (LIMIT/OFFSET) y no en memoria: la tabla crece sin
// límite y traerla entera sería cada vez más caro.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { ETIQUETAS_EVENTO, TIPOS_EVENTO } from "@/lib/audit";

const POR_PAGINA_MAX = 100;
const POR_PAGINA_DEFECTO = 25;

const TIPOS_VALIDOS = new Set<string>(Object.values(TIPOS_EVENTO));

export async function GET(req: NextRequest) {
  try {
    const usuario = getUsuarioFromRequest(req);
    if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
      return unauthorizedError();
    }

    const limite = await checkRateLimit(`auditoria:GET:${getClientIp(req)}`, 60, 60_000);
    if (limite.limited) {
      return NextResponse.json(
        { error: `Demasiadas consultas. Intentá de nuevo en ${limite.retryAfterSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
      );
    }

    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const tipo = (sp.get("tipo") ?? "").trim();

    const pagina = Math.max(1, Number(sp.get("pagina") ?? "1") || 1);
    const porPagina = Math.min(
      POR_PAGINA_MAX,
      Math.max(1, Number(sp.get("por_pagina") ?? String(POR_PAGINA_DEFECTO)) || POR_PAGINA_DEFECTO)
    );
    const offset = (pagina - 1) * porPagina;

    const filtros: string[] = [];
    const params: unknown[] = [];

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      filtros.push(`LOWER(COALESCE(correo, '')) LIKE $${params.length}`);
    }
    if (tipo) {
      if (!TIPOS_VALIDOS.has(tipo)) {
        return NextResponse.json(
          { error: `tipo inválido. Valores permitidos: ${[...TIPOS_VALIDOS].join(", ")}` },
          { status: 400 }
        );
      }
      params.push(tipo);
      filtros.push(`tipo_evento = $${params.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const total = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM auditoria ${where}`,
      params
    );

    params.push(porPagina, offset);
    const registros = await pool.query(
      `SELECT a.id,
              a.id_usuario,
              a.correo,
              a.tipo_evento,
              a.ip,
              a.user_agent,
              a.detalle,
              a.creado_en,
              u.nombre AS nombre_usuario
         FROM auditoria a
         LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
         ${where}
        ORDER BY a.creado_en DESC, a.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({
      registros: registros.rows,
      total: total.rows[0]?.total ?? 0,
      pagina,
      por_pagina: porPagina,
      etiquetas: ETIQUETAS_EVENTO,
    });
  } catch (error) {
    return apiError("USUARIOS AUDITORIA GET", error);
  }
}