import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { unauthorizedError } from "@/lib/api-error";
import { identificador } from "@/lib/compras";
import { pagarCompra } from "@/lib/compras-service";
import { errorCompra } from "@/lib/compras-api";

export async function POST(req: NextRequest, context: {params:Promise<{id:string}>}) {
  const u = getUsuarioFromRequest(req);
  if (!u || !isDuenoTipo(u.tipo_usuario)) return unauthorizedError();
  try { return NextResponse.json(await pagarCompra(identificador((await context.params).id),await req.json(),u.id_usuario)); }
  catch(e) { return errorCompra("COMPRAS PAGO",e); }
}
