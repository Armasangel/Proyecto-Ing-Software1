import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { unauthorizedError } from "@/lib/api-error";
import { pool } from "@/lib/db";
import { recibirCompra } from "@/lib/compras-service";
import { errorCompra } from "@/lib/compras-api";
export async function GET(req: NextRequest) {
  const u = getUsuarioFromRequest(req);
  if (!u || !(isStaffTipo(u.tipo_usuario) || isBodegueroTipo(u.tipo_usuario))) return unauthorizedError();
  try {
    // Proyección explícita: jamás enviar cantidades compradas, costos, tolerancia ni factura.
    const proyeccion=`SELECT r.id_recepcion,r.id_bodega,r.estado,r.conteo,r.constancia,r.creada_en,r.parcial,
      b.nombre_bodega FROM compra_recepcion r JOIN bodega b USING(id_bodega)
      WHERE r.id_usuario=$1 AND ($2::int IS NULL OR r.id_bodega=$2)`;
    const args=[u.id_usuario,isBodegueroTipo(u.tipo_usuario)?u.id_bodega??0:null];
    const [result,pendientes]=await Promise.all([
      pool.query(`${proyeccion} ORDER BY r.creada_en DESC,r.id_recepcion DESC LIMIT 5`,args),
      // Los recuentos pendientes siguen accesibles aunque no estén entre los últimos cinco.
      pool.query(`${proyeccion} AND r.estado='RECONTAR' ORDER BY r.id_recepcion`,args),
    ]);
    return NextResponse.json({recepciones:result.rows,pendientes:pendientes.rows},{headers:{"Cache-Control":"no-store"}});
  } catch(e) { return errorCompra("RECEPCIONES GET",e); }
}
export async function POST(req: NextRequest) {
  const u = getUsuarioFromRequest(req);
  if (!u || !(isStaffTipo(u.tipo_usuario) || isBodegueroTipo(u.tipo_usuario))) return unauthorizedError();
  try { return NextResponse.json(await recibirCompra(await req.json(),u)); }
  catch(e) { return errorCompra("RECEPCIONES POST",e); }
}
