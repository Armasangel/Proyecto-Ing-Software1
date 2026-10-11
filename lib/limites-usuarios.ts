// lib/limites-usuarios.ts
//
// Helpers del límite de usuarios ACTIVOS por tipo (tabla limite_tipo_usuario,
// migración 06). El tope real se aplica en la BD con el trigger
// trg_validar_limite_usuarios; estos helpers sirven para mostrar el cupo en
// la UI, validar antes de mandar un código por correo y traducir el error del
// trigger a una respuesta clara.
import type { Pool, PoolClient } from "pg";
import { NextResponse } from "next/server";
import { MAX_DUENOS, TIPOS_USUARIO, labelRol } from "@/lib/roles";

type Db = Pick<Pool | PoolClient, "query">;

export const TIPOS_LIMITABLES = [
  TIPOS_USUARIO.DUENO,
  TIPOS_USUARIO.EMPLEADO,
  TIPOS_USUARIO.BODEGUERO,
] as const;

/** Tope máximo que se acepta al configurar un límite (evita valores absurdos). */
export const LIMITE_MAXIMO_CONFIGURABLE = 500;

export function esTipoLimitable(tipo: unknown): tipo is (typeof TIPOS_LIMITABLES)[number] {
  return typeof tipo === "string" && (TIPOS_LIMITABLES as readonly string[]).includes(tipo);
}

export interface CupoTipo {
  tipo_usuario: string;
  /** null = sin límite */
  limite: number | null;
  activos: number;
}

/** Límite y usuarios activos de un tipo, en una sola consulta. */
export async function leerCupo(db: Db, tipo: string): Promise<CupoTipo> {
  const r = await db.query<{ configurado: boolean; limite: number | null; activos: number }>(
    `SELECT l.tipo_usuario IS NOT NULL AS configurado,
            l.max_usuarios AS limite,
            (SELECT COUNT(*)::int FROM usuario u
              WHERE u.tipo_usuario = $1 AND u.estado_usuario = TRUE) AS activos
       FROM (SELECT $1::varchar AS tipo) t
       LEFT JOIN limite_tipo_usuario l ON l.tipo_usuario = t.tipo`,
    [tipo]
  );
  const fila = r.rows[0];
  // Si la fila del límite no existe (migración sin correr), el dueño conserva
  // el tope histórico y el resto queda sin límite.
  const limite = fila.configurado
    ? fila.limite
    : tipo === TIPOS_USUARIO.DUENO
      ? MAX_DUENOS
      : null;
  return { tipo_usuario: tipo, limite, activos: fila.activos };
}

/** Cupo de todos los tipos (para la pestaña de Usuarios). */
export async function leerTodosLosCupos(db: Db): Promise<CupoTipo[]> {
  const r = await db.query<{ tipo_usuario: string; limite: number | null; activos: number }>(
    `SELECT t.tipo AS tipo_usuario,
            l.max_usuarios AS limite,
            (SELECT COUNT(*)::int FROM usuario u
              WHERE u.tipo_usuario = t.tipo AND u.estado_usuario = TRUE) AS activos
       FROM (VALUES ('DUENO'), ('EMPLEADO'), ('BODEGUERO')) AS t(tipo)
       LEFT JOIN limite_tipo_usuario l ON l.tipo_usuario = t.tipo
      ORDER BY t.tipo`
  );
  return r.rows;
}

export function cupoLleno(c: CupoTipo): boolean {
  return c.limite !== null && c.activos >= c.limite;
}

export function mensajeLimiteAlcanzado(tipo: string, limite: number | string | null): string {
  const rol = labelRol(tipo).toLowerCase();
  return `Ya hay ${limite ?? "el máximo de"} usuarios activos tipo ${rol}, el límite configurado. Sube el límite (con verificación en 2 pasos) o desactiva a alguno antes de agregar otro.`;
}

/**
 * Si `error` es el que lanza el trigger de límites (SQLSTATE LU001), devuelve
 * la respuesta 409 lista; si no, null para que el catch siga con apiError.
 */
export function respuestaSiLimiteAlcanzado(error: unknown): NextResponse | null {
  const e = error as { code?: string; detail?: string; hint?: string } | null;
  if (!e || e.code !== "LU001") return null;
  const tipo = e.detail ?? "";
  return NextResponse.json(
    {
      error: mensajeLimiteAlcanzado(tipo, e.hint ?? null),
      codigo: "LIMITE_USUARIOS",
      tipo_usuario: tipo,
    },
    { status: 409 }
  );
}
