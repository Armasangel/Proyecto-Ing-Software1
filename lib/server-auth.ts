import { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthToken, type AuthUsuario } from "@/lib/auth";

export function getUsuarioFromRequest(req: NextRequest): AuthUsuario | null {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}
