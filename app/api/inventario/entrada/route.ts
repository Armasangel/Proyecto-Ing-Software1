import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { unauthorizedError } from "@/lib/api-error";

/** El ingreso directo se retira para impedir saltarse compra, recuento y autorización. */
export async function POST(req: NextRequest) {
  const u = getUsuarioFromRequest(req);
  if (!u || !(isStaffTipo(u.tipo_usuario) || isBodegueroTipo(u.tipo_usuario))) return unauthorizedError();
  return NextResponse.json({ error: "Registra la recepción desde Entrada. El ingreso requiere vincularse a un ticket de compra." }, { status: 410 });
}
