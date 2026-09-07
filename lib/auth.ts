import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const AUTH_COOKIE = "auth_token";

export const JWT_SECRET_MIN_LENGTH = 32;

export type AuthUsuario = {
  id_usuario: number
  nombre: string
  correo: string
  tipo_usuario: string
  // Bodega fija asignada (solo aplica a tipo_usuario === "BODEGUERO").
  id_bodega?: number | null
};

export function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (!fromEnv) throw new Error("JWT_SECRET is required");
  if (fromEnv.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
  }
  return fromEnv;
}

export function signAuthToken(usuario: AuthUsuario): string {
  return jwt.sign(
    {
      nombre: usuario.nombre,
      correo: usuario.correo,
      tipo_usuario: usuario.tipo_usuario,
      id_bodega: usuario.id_bodega ?? null,
    },
    getJwtSecret(),
    {
      subject: String(usuario.id_usuario),
      expiresIn: "8h",
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
    };
    const id = decoded.sub;
    if (typeof id !== "string" || !id) return null;
    return {
      id_usuario: Number(id),
      nombre: decoded.nombre,
      correo: decoded.correo,
      tipo_usuario: decoded.tipo_usuario,
      id_bodega: decoded.id_bodega ?? null,
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