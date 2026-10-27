// app/api/usuarios/auditoria/route.ts
//
// Lectura de la bitácora de credenciales. Sólo para el dueño.
//
// Filtros: `?q=` busca por correo, `?tipo=` por tipo de evento,
// `?page=` y `?limit=` para paginar (unificado con el resto de la API).
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

const TIPOS_VALIDOS = new Set<string>(Object.values(TIPOS_EVENTO));
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

    // Paginación unificada: ?page y ?limit (antes: ?pagina y ?por_pagina).
    const { page, limit } = parsePaginationParams(sp, { defaultLimit: DEFAULT_LIMIT, maxLimit: MAX_LIMIT });
    const offset = (page - 1) * limit;

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

    // Count query for total (siempre necesario para totalPages).
    const countResult = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM auditoria ${where}`,
      params
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    const meta = buildPaginationMeta(total, { page, limit, offset });

    // Query de datos con LIMIT/OFFSET parametrizados.
    const result = await pool.query(
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
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const registros = result.rows;

    const pagination = buildPaginationMeta(total, { page, limit, offset });

    return NextResponse.json({
      registros,
      total,
      page: meta.page,
      limit: meta.limit,
      totalPages: meta.totalPages,
      hasMore: meta.hasMore,
      nextPage: meta.nextPage,
      prevPage: meta.prevPage,
      etiquetas: ETIQUETAS_EVENTO,
    });
  } catch (error) {
    return apiError("USUARIOS AUDITORIA GET", error);
  }
}