// lib/audit.ts
//
// Bitácora de eventos de credenciales (OWASP ASVS V7: Security Logging).
//
// Regla de oro de este módulo: registrar un evento NUNCA puede romper la
// operación que lo originó. Si la escritura en la bitácora falla, el login
// tiene que funcionar igual; se pierde una línea de bitácora, no la tienda.
// Por eso `registrarAuditoria` nunca lanza: traga el error y lo deja en el log
// de aplicación, que es el respaldo que ya existía.

import { pool } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const log = getLogger("lib/audit");

/** Eventos de credenciales que se registran. */
export const TIPOS_EVENTO = {
  LOGIN_OK: "LOGIN_OK",
  LOGIN_FALLIDO: "LOGIN_FALLIDO",
  CUENTA_BLOQUEADA: "CUENTA_BLOQUEADA",
  LOGOUT: "LOGOUT",
  PASSWORD_RESET_SOLICITADO: "PASSWORD_RESET_SOLICITADO",
  PASSWORD_CAMBIO: "PASSWORD_CAMBIO",
  PASSWORD_CAMBIO_RECHAZADO: "PASSWORD_CAMBIO_RECHAZADO",
  SESIONES_REVOCADAS: "SESIONES_REVOCADAS",
  USUARIO_CREADO: "USUARIO_CREADO",
  USUARIO_DESHABILITADO: "USUARIO_DESHABILITADO",
  ROL_CAMBIADO: "ROL_CAMBIADO",
  PROMOCION_DUENO: "PROMOCION_DUENO",
} as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[keyof typeof TIPOS_EVENTO];

/** Etiquetas legibles para el panel del dueño. */
export const ETIQUETAS_EVENTO: Record<string, string> = {
  LOGIN_OK: "Inicio de sesión",
  LOGIN_FALLIDO: "Intento fallido",
  CUENTA_BLOQUEADA: "Cuenta bloqueada",
  LOGOUT: "Cierre de sesión",
  PASSWORD_RESET_SOLICITADO: "Recuperación pedida",
  PASSWORD_CAMBIO: "Contraseña cambiada",
  PASSWORD_CAMBIO_RECHAZADO: "Cambio de contraseña fallido",
  SESIONES_REVOCADAS: "Sesiones cerradas",
  USUARIO_CREADO: "Usuario creado",
  USUARIO_DESHABILITADO: "Usuario deshabilitado",
  ROL_CAMBIADO: "Permisos modificados",
  PROMOCION_DUENO: "Promoción a dueño",
};

export type EventoAuditoria = {
  id_usuario?: number | null;
  correo?: string | null;
  tipo_evento: TipoEvento;
  ip?: string | null;
  user_agent?: string | null;
  detalle?: Record<string, unknown>;
};

/** Recorta el User-Agent: puede ser enorme y no aporta nada útil. */
function recortar(valor: string | null | undefined, max = 300): string | null {
  if (!valor) return null;
  return valor.length > max ? `${valor.slice(0, max)}…` : valor;
}

/**
 * Escribe un evento en la bitácora. Nunca lanza.
 *
 * El `detalle` va en JSONB: se indexa y se filtra desde la API sin tocar el
 * esquema. NUNCA debe llevar contraseñas ni hashes — para el registro basta
 * con decir QUÉ pasó, no con qué clave.
 */
export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO auditoria (id_usuario, correo, tipo_evento, ip, user_agent, detalle)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        evento.id_usuario ?? null,
        evento.correo ?? null,
        evento.tipo_evento,
        evento.ip ?? null,
        recortar(evento.user_agent),
        JSON.stringify(evento.detalle ?? {}),
      ]
    );
  } catch (error) {
    // La bitácora es un registro de auditoría, no un requisito de disponibilidad:
    // si falla, el evento se pierde pero la operación principal sigue.
    log.error(
      { err: error, tipo_evento: evento.tipo_evento, id_usuario: evento.id_usuario },
      "No se pudo registrar el evento en la bitácora de credenciales"
    );
  }
}
