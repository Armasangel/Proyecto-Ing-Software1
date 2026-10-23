import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { unauthorizedError } from "@/lib/api-error";
import { identificador } from "@/lib/compras";
import { recontarCompra } from "@/lib/compras-service";
import { errorCompra } from "@/lib/compras-api";
export async function PATCH(req: NextRequest, context:{params:Promise<{id:string}>}) {
  const u = getUsuarioFromRequest(req);
  if (!u || !(isStaffTipo(u.tipo_usuario) || isBodegueroTipo(u.tipo_usuario))) return unauthorizedError();
  try { return NextResponse.json(await recontarCompra(identificador((await context.params).id),await req.json(),u)); }
  catch(e) { return errorCompra("RECEPCIONES RECONTAR",e); }
}
