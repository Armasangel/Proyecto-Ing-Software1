import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { unauthorizedError } from "@/lib/api-error";
import { identificador } from "@/lib/compras";
import { pool } from "@/lib/db";
import { errorCompra } from "@/lib/compras-api";
export async function PATCH(req: NextRequest) {
  const u = getUsuarioFromRequest(req);
  if (!u || !isDuenoTipo(u.tipo_usuario)) return unauthorizedError();
  try {
    await pool.query(`UPDATE compra_aviso SET leido=TRUE WHERE id_aviso=$1`,[identificador((await req.json()).id_aviso)]);
    return NextResponse.json({ok:true});
  } catch(e) { return errorCompra("COMPRA AVISO",e); }
}
