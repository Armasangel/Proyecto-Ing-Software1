import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const [productos, ventas, pendientes, proveedores] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM producto WHERE estado_producto = TRUE`),
      pool.query(`SELECT COUNT(*)::int AS n FROM venta`),
      pool.query(`SELECT COUNT(*)::int AS n FROM venta WHERE estado_venta = 'PENDIENTE'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM proveedor WHERE estado_proveedor = TRUE`),
    ]);

    return NextResponse.json({
      stats: {
        productos: productos.rows[0]?.n ?? 0,
        ventas: ventas.rows[0]?.n ?? 0,
        pendientes: pendientes.rows[0]?.n ?? 0,
        proveedores: proveedores.rows[0]?.n ?? 0,
      },
    });
  } catch (error) {
    console.error("[STATS]", error);
    return NextResponse.json(
      { stats: { productos: 0, ventas: 0, pendientes: 0, proveedores: 0 } },
      { status: 200 }
    );
  }
}
