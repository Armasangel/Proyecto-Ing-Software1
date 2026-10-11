import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const AUTH_COOKIE = "auth_token";

export const JWT_SECRET_MIN_LENGTH = 32;

/** Vida de la sesión, en segundos (8 h). Fuente única: el TTL del JWT y el
 *  maxAge de la cookie se derivan de aquí para que no puedan desincronizarse. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Opciones de la cookie de sesión, idénticas en todos los puntos donde se emite. */
export function authCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export type AuthUsuario = {
  id_usuario: number
  nombre: string
  correo: string
  tipo_usuario: string
  // Bodega fija asignada (solo aplica a tipo_usuario === "BODEGUERO").
  id_bodega?: number | null
  // Versión de sesión con la que se emitió el token (claim `sv`), tal como
  // quedó al leerla de la base. Se compara contra usuario.sesion_version en
  // cada request (ver lib/sesion.ts).
  sesion_version?: number
};

/**
 * Usuario tal como puede FIRMAR un token. `sesion_version` es obligatoria a
 * propósito: si se firmara con un valor por defecto (por ejemplo 1) y la
 * cuenta ya hubiera sido revocada, el token nuevo nacería obsoleto y el
 * usuario no podría volver a entrar nunca. Mejor que el compilador lo exija.
 */
export type UsuarioParaFirmar = AuthUsuario & { sesion_version: number };

export function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (!fromEnv) throw new Error("JWT_SECRET is required");
  if (fromEnv.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
  }
  return fromEnv;
}

export function signAuthToken(usuario: UsuarioParaFirmar): string {
  return jwt.sign(
    {
      nombre: usuario.nombre,
      correo: usuario.correo,
      tipo_usuario: usuario.tipo_usuario,
      id_bodega: usuario.id_bodega ?? null,
      sv: usuario.sesion_version,
    },
    getJwtSecret(),
    {
      subject: String(usuario.id_usuario),
      expiresIn: SESSION_TTL_SECONDS,
    }
  );
}

export function verifyAuthToken(token: string): AuthUsuario | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & {
      nombre: string
      correo: string
      tipo_usuario: string
      id_bodega?: number | null
      sv?: number
    };
    const id = decoded.sub;
    if (typeof id !== "string" || !id) return null;
    return {
      id_usuario: Number(id),
      nombre: decoded.nombre,
      correo: decoded.correo,
      tipo_usuario: decoded.tipo_usuario,
      id_bodega: decoded.id_bodega ?? null,
      sesion_version: typeof decoded.sv === "number" ? decoded.sv : 1,
    };
  } catch {
    return null;
  }
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}