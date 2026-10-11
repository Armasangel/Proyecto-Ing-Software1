// app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { getClientIp } from "@/lib/login-rate-limit";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/logout");

export async function POST(req: NextRequest) {
  // Se registra el cierre de sesión: sin esto, la reutilización de un token
  // robado después de un logout es indetectable (ASVS V7).
  const usuario = getUsuarioFromRequest(req);
  if (usuario) {
    await registrarAuditoria({
      id_usuario: usuario.id_usuario,
      correo: usuario.correo,
      tipo_evento: TIPOS_EVENTO.LOGOUT,
      ip: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
      detalle: { tipo_usuario: usuario.tipo_usuario },
    });

    log.info(
      { id_usuario: usuario.id_usuario, tipo_usuario: usuario.tipo_usuario, ip: getClientIp(req) },
      "Logout"
    );
  } else {
    log.warn({ ip: getClientIp(req) }, "Logout sin sesión válida");
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}