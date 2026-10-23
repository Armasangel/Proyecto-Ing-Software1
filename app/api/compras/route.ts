import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { unauthorizedError } from "@/lib/api-error";
import { pool } from "@/lib/db";
import { crearCompra } from "@/lib/compras-service";
import { errorCompra } from "@/lib/compras-api";
import { normalizarUnidad } from "@/lib/presentaciones";

export async function GET(req: NextRequest) {
  const u = getUsuarioFromRequest(req);
  if (!u || !isDuenoTipo(u.tipo_usuario)) return unauthorizedError();
  try {
    const [compras, productos, proveedores, avisos] = await Promise.all([
      pool.query(`SELECT c.*, COALESCE((SELECT SUM(monto) FROM compra_pago WHERE id_compra=c.id_compra),0) AS pagado,
        COALESCE((SELECT json_agg(d ORDER BY d.id_detalle) FROM compra_detalle d WHERE d.id_compra=c.id_compra),'[]') AS productos,
        COALESCE((SELECT json_agg(r ORDER BY r.id_recepcion DESC) FROM compra_recepcion r WHERE r.id_compra=c.id_compra),'[]') AS recepciones,
        COALESCE((SELECT json_agg(pg ORDER BY pg.id_pago) FROM compra_pago pg WHERE pg.id_compra=c.id_compra),'[]') AS pagos
        FROM compra c ORDER BY (c.estado <> 'RECIBIDA' OR c.total > COALESCE((SELECT SUM(monto) FROM compra_pago WHERE id_compra=c.id_compra),0)) DESC, c.id_compra DESC LIMIT 200`),
      pool.query(`SELECT p.id_producto,p.nombre_producto,p.codigo_producto,p.unidad_medida,p.precio_unitario,p.precio_mayoreo,
        (SELECT d.costo_base FROM compra_detalle d WHERE d.id_producto=p.id_producto AND d.unidad_base=p.unidad_medida ORDER BY d.id_detalle DESC LIMIT 1) AS costo_anterior,
        COALESCE((SELECT json_agg(pp ORDER BY pp.nombre_presentacion) FROM presentacion_producto pp
          WHERE pp.id_producto=p.id_producto AND pp.estado_presentacion=TRUE),'[]') AS presentaciones
        FROM producto p WHERE p.estado_producto=TRUE ORDER BY p.nombre_producto`),
      pool.query(`SELECT id_proveedor,nombre_proveedor,nit_proveedor,correo_contacto,telefono FROM proveedor WHERE estado_proveedor=TRUE ORDER BY nombre_proveedor`),
      pool.query(`SELECT a.*, c.ticket FROM compra_aviso a JOIN compra c USING(id_compra) WHERE a.leido=FALSE ORDER BY a.id_aviso DESC`),
    ]);
    return NextResponse.json({compras:compras.rows,productos:productos.rows.map(p=>({...p,
      presentaciones:p.presentaciones.filter((pr:{unidad_base:string})=>pr.unidad_base===normalizarUnidad(p.unidad_medida)),
    })),proveedores:proveedores.rows,avisos:avisos.rows}, {headers:{"Cache-Control":"no-store"}});
  } catch(e) { return errorCompra("COMPRAS GET",e); }
}
export async function POST(req: NextRequest) {
  const u = getUsuarioFromRequest(req);
  if (!u || !isDuenoTipo(u.tipo_usuario)) return unauthorizedError();
  try { return NextResponse.json(await crearCompra(await req.json(),u.id_usuario),{status:201}); }
  catch(e) { return errorCompra("COMPRAS POST",e); }
}
