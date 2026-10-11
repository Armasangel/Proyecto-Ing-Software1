// lib/sesion.ts
//
// Revocación de sesiones (OWASP ASVS V3.2).
//
// El JWT es sin estado por diseño, así que por sí solo no se puede "deshacer":
// un token robado seguiría valiendo hasta que expire. Para cerrarlo, cada
// token lleva el claim `sv` con el valor de usuario.sesion_version en el
// momento en que se emitió, y cada request compara ese valor contra la fila
// actual del usuario.
//
// Un solo número resuelve de golpe:
//   · cerrar sesión en todos los dispositivos   → sesion_version + 1
//   · cambio de contraseña                      → sesion_version + 1
//   · cambio de rol                             → sesion_version + 1
//   · usuario deshabilitado                     → estado_usuario = FALSE

import { pool } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const log = getLogger("lib/sesion");

/**
 * Valida el par (id_usuario, sesion_version del token) contra la base.
 * Devuelve false si el usuario ya no existe, está deshabilitado, o el token
 * se emitió con una versión anterior de su sesión (o sea: fue revocado).
 */
export async function esSesionValida(
  id_usuario: number,
  sesionDelToken: number | undefined
): Promise<boolean> {
  try {
    const result = await pool.query<{ sesion_version: number; estado_usuario: boolean }>(
      `SELECT sesion_version, estado_usuario
         FROM usuario
        WHERE id_usuario = $1`,
      [id_usuario]
    );

    const row = result.rows[0];
    if (!row) return false;
    if (!row.estado_usuario) return false;

    return Number(row.sesion_version) === Number(sesionDelToken ?? 1);
  } catch (error) {
    // Ante un fallo de base de datos no se concede acceso por omisión: se
    // deniega. Cerrar la app por un problema de connectivity es preferible a
    // dejar pasar tokens potencialmente revocados.
    log.error({ err: error, id_usuario }, "No se pudo validar la sesión contra la base");
    return false;
  }
}

/** Sube la versión de sesión: invalida todos los tokens previos del usuario. */
export async function revocarSesiones(id_usuario: number): Promise<void> {
  await pool.query(
    `UPDATE usuario
        SET sesion_version = sesion_version + 1
      WHERE id_usuario = $1`,
    [id_usuario]
  );
}

/** Registra el último acceso, para /mi-cuenta y para detectar accesos ajenos. */
export async function registrarAcceso(id_usuario: number, ip: string): Promise<void> {
  await pool.query(
    `UPDATE usuario
        SET ultimo_login_en = NOW(), ultimo_login_ip = $2
      WHERE id_usuario = $1`,
    [id_usuario, ip]
  );
}
