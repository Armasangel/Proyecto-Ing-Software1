// app/api/tienda/pedidos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";

// GET /api/tienda/pedidos → trae los pedidos del cliente logueado
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const esComprador =
    usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR ||
    usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR_MAYOR;

  if (!esComprador) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    // Traer ventas del cliente con su detalle
    const ventas = await pool.query(
      `SELECT
         v.id_venta,
         v.fecha_venta,
         v.estado_venta,
         v.tipo_venta,
         v.total,
         v.fecha_limite_pago
       FROM venta v
       WHERE v.id_usuario = $1
       ORDER BY v.fecha_venta DESC`,
      [usuario.id_usuario]
    );

    // Para cada venta traer el detalle
    const pedidos = await Promise.all(
      ventas.rows.map(async (venta: Record<string, unknown>) => {
        const detalle = await pool.query(
          `SELECT
             dv.cantidad,
             dv.precio_unitario,
             dv.subtotal,
             p.nombre_producto,
             p.unidad_medida,
             p.codigo_producto
           FROM detalle_venta dv
           JOIN producto p ON p.id_producto = dv.id_producto
           WHERE dv.id_venta = $1`,
          [venta.id_venta]
        );
        return {
          ...venta,
          items: detalle.rows,
        };
      })
    );

    return NextResponse.json({ pedidos });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al cargar pedidos", detalle: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/tienda/pedidos → crea una nueva reserva
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const esComprador =
    usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR ||
    usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR_MAYOR;

  if (!esComprador) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { items } = body;
    // items: [{ id_producto, cantidad, precio_unitario }]

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
    }

    const esMayorista = usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR_MAYOR;
    const tipoVenta = esMayorista ? "MAYORISTA" : "MINORISTA";

    // Calcular total
    const total = items.reduce(
      (sum: number, item: { cantidad: number; precio_unitario: number }) =>
        sum + item.cantidad * item.precio_unitario,
      0
    );

    // Fecha límite: 3 días desde hoy
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 3);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Crear la venta
      const ventaResult = await client.query(
        `INSERT INTO venta
           (id_usuario, estado_venta, tipo_venta, tipo_entrega, enlinea, total, fecha_limite_pago)
         VALUES ($1, 'PENDIENTE', $2, 'EN_TIENDA', TRUE, $3, $4)
         RETURNING id_venta`,
        [usuario.id_usuario, tipoVenta, total.toFixed(2), fechaLimite.toISOString().split("T")[0]]
      );

      const id_venta = ventaResult.rows[0].id_venta;

      // Insertar detalle de venta
      for (const item of items) {
        const subtotal = item.cantidad * item.precio_unitario;
        await client.query(
          `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [id_venta, item.id_producto, item.cantidad, item.precio_unitario, subtotal.toFixed(2)]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        mensaje: "Reserva creada exitosamente ✅",
        id_venta,
        total: total.toFixed(2),
        fecha_limite_pago: fechaLimite.toISOString().split("T")[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear reserva", detalle: String(error) },
      { status: 500 }
    );
  }
}