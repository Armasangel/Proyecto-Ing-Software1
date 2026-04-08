import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const AUTH_COOKIE = "auth_token";

export type AuthUsuario = {
  id_usuario: number
  nombre: string
  correo: string
  tipo_usuario: string
};

export function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "deposito_san_miguel_secret_key_dev";
  }
  throw new Error("JWT_SECRET is required");
}

export function signAuthToken(usuario: AuthUsuario): string {
  return jwt.sign(
    {
      nombre: usuario.nombre,
      correo: usuario.correo,
      tipo_usuario: usuario.tipo_usuario,
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
    };
    const id = decoded.sub;
    if (typeof id !== "string" || !id) return null;
    return {
      id_usuario: Number(id),
      nombre: decoded.nombre,
      correo: decoded.correo,
      tipo_usuario: decoded.tipo_usuario,
    };
  } catch {
    return null;
  }
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
