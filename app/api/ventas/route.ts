<<<<<<< HEAD
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isColaboradorTipo } from "@/lib/roles";

const ESTADOS_VENTA = ["PENDIENTE", "CONFIRMADO", "ENTREGADO", "PAGADO"] as const;
const TIPOS_VENTA = ["MINORISTA", "MAYORISTA"] as const;
const TIPOS_ENTREGA = ["EN_TIENDA", "DOMICILIO"] as const;

type EstadoVenta = (typeof ESTADOS_VENTA)[number];
type TipoVenta = (typeof TIPOS_VENTA)[number];
type TipoEntrega = (typeof TIPOS_ENTREGA)[number];

function isEstadoVenta(s: string): s is EstadoVenta {
  return (ESTADOS_VENTA as readonly string[]).includes(s);
}
function isTipoVenta(s: string): s is TipoVenta {
  return (TIPOS_VENTA as readonly string[]).includes(s);
}
function isTipoEntrega(s: string): s is TipoEntrega {
  return (TIPOS_ENTREGA as readonly string[]).includes(s);
}

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isColaboradorTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.id_usuario,
        v.id_empleado,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.total,
        v.fecha_limite_pago,
        uc.nombre AS nombre_cliente,
        uc.correo AS correo_cliente,
        ue.nombre AS nombre_colaborador,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', dv.id_detalle_venta,
              'id_venta', dv.id_venta,
              'codigo_producto', p.codigo_producto,
              'id_producto', dv.id_producto,
              'cantidad', dv.cantidad,
              'precio_unitario_venta', dv.precio_unitario,
              'subtotal', dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      JOIN usuario uc ON uc.id_usuario = v.id_usuario
      LEFT JOIN usuario ue ON ue.id_usuario = v.id_empleado
      LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      LEFT JOIN producto p ON p.id_producto = dv.id_producto
      GROUP BY
        v.id_venta,
        v.id_usuario,
        v.id_empleado,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.total,
        v.fecha_limite_pago,
        uc.nombre,
        uc.correo,
        ue.nombre
      ORDER BY v.fecha_venta DESC
      LIMIT 80
    `);

    return NextResponse.json({ ventas: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar ventas", detalle: String(error) },
      { status: 500 }
    );
  }
}

type LineaInput = {
  id_producto: number;
  cantidad: number;
  precio_unitario_venta: number;
};

export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  if (!usuario || !isColaboradorTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      id_usuario: idCliente,
      estado_pago,
      estado_venta: estadoVentaBody,
      tipo_venta,
      tipo_entrega,
      direccion_entrega,
      fecha_limite_pago,
      id_bodega,
      lineas,
    } = body;

    const estadoRaw = estado_pago ?? estadoVentaBody;
    if (typeof estadoRaw !== "string" || !isEstadoVenta(estadoRaw)) {
      return NextResponse.json(
        {
          error:
            "estado_pago / estado_venta inválido. Use: PENDIENTE, CONFIRMADO, ENTREGADO o PAGADO",
        },
        { status: 400 }
      );
    }
    const estado_venta = estadoRaw;

    if (typeof tipo_venta !== "string" || !isTipoVenta(tipo_venta)) {
      return NextResponse.json(
        { error: "tipo_venta debe ser MINORISTA o MAYORISTA" },
        { status: 400 }
      );
    }

    if (typeof tipo_entrega !== "string" || !isTipoEntrega(tipo_entrega)) {
      return NextResponse.json(
        { error: "tipo_entrega debe ser EN_TIENDA o DOMICILIO" },
        { status: 400 }
      );
    }

    const direccion =
      typeof direccion_entrega === "string" ? direccion_entrega.trim() : "";
    if (tipo_entrega === "DOMICILIO" && !direccion) {
      return NextResponse.json(
        { error: "La dirección de entrega es obligatoria para domicilio" },
        { status: 400 }
      );
    }

    const idBodega = Number(id_bodega);
    if (!idBodega || idBodega < 1) {
      return NextResponse.json({ error: "id_bodega inválido" }, { status: 400 });
    }

    if (!idCliente || Number(idCliente) < 1) {
      return NextResponse.json({ error: "Debe seleccionar un cliente" }, { status: 400 });
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return NextResponse.json(
        { error: "Agregue al menos un producto a la venta" },
        { status: 400 }
      );
    }

    const lineasNorm: LineaInput[] = [];
    for (const L of lineas as unknown[]) {
      if (!L || typeof L !== "object") continue;
      const o = L as Record<string, unknown>;
      const id_producto = Number(o.id_producto);
      const cantidad = Number(o.cantidad);
      const precio_unitario_venta = Number(o.precio_unitario_venta);
      if (!id_producto || cantidad <= 0 || precio_unitario_venta < 0) {
        return NextResponse.json(
          { error: "Cada línea requiere id_producto, cantidad > 0 y precio válido" },
          { status: 400 }
        );
      }
      lineasNorm.push({ id_producto, cantidad, precio_unitario_venta });
    }

    if (lineasNorm.length === 0) {
      return NextResponse.json({ error: "Líneas de venta inválidas" }, { status: 400 });
    }

    let fechaLimite: string | null = null;
    if (fecha_limite_pago != null && String(fecha_limite_pago).trim() !== "") {
      fechaLimite = String(fecha_limite_pago).trim();
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existeCliente = await client.query(
        `SELECT 1 FROM usuario WHERE id_usuario = $1 AND estado_usuario = TRUE`,
        [idCliente]
      );
      if (existeCliente.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
      }

      const existeBodega = await client.query(
        `SELECT 1 FROM bodega WHERE id_bodega = $1`,
        [idBodega]
      );
      if (existeBodega.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Bodega no encontrada" }, { status: 400 });
      }

      let total = 0;
      const prepared: Array<{
        id_producto: number;
        cantidad: number;
        precio: number;
        subtotal: number;
      }> = [];

      for (const ln of lineasNorm) {
        const prod = await client.query(
          `SELECT id_producto, estado_producto FROM producto WHERE id_producto = $1`,
          [ln.id_producto]
        );
        if (prod.rowCount === 0 || !prod.rows[0].estado_producto) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: `Producto no disponible: id ${ln.id_producto}` },
            { status: 400 }
          );
        }

        const subQ = await client.query(
          `SELECT ROUND(($1::numeric * $2::numeric), 2) AS sub`,
          [ln.cantidad, ln.precio_unitario_venta]
        );
        const subtotal = Number(subQ.rows[0].sub);
        total += subtotal;
        prepared.push({
          id_producto: ln.id_producto,
          cantidad: ln.cantidad,
          precio: ln.precio_unitario_venta,
          subtotal,
        });
      }

      const totalQ = await client.query(
        `SELECT ROUND($1::numeric, 2) AS t`,
        [total]
      );
      total = Number(totalQ.rows[0].t);

      const insVenta = await client.query(
        `
        INSERT INTO venta (
          id_usuario,
          id_empleado,
          estado_venta,
          tipo_venta,
          tipo_entrega,
          direccion_entrega,
          enlinea,
          total,
          fecha_limite_pago
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)
        RETURNING id_venta
        `,
        [
          idCliente,
          usuario.id_usuario,
          estado_venta,
          tipo_venta,
          tipo_entrega,
          tipo_entrega === "EN_TIENDA" ? null : direccion || null,
          total,
          fechaLimite,
        ]
      );

      const idVenta = insVenta.rows[0].id_venta as number;

      for (const p of prepared) {
        const stock = await client.query(
          `
          SELECT cantidad_disponible
          FROM bodega_producto
          WHERE id_bodega = $1 AND id_producto = $2
          `,
          [idBodega, p.id_producto]
        );
        const disponible =
          stock.rowCount && stock.rows[0]
            ? Number(stock.rows[0].cantidad_disponible)
            : 0;
        if (disponible < p.cantidad) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              error: `Stock insuficiente para el producto id ${p.id_producto} en la bodega seleccionada (disponible: ${disponible})`,
            },
            { status: 400 }
          );
        }

        await client.query(
          `
          INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [idVenta, p.id_producto, p.cantidad, p.precio, p.subtotal]
        );

        await client.query(
          `
          UPDATE bodega_producto
          SET cantidad_disponible = cantidad_disponible - $1,
              ultima_actualizacion = NOW()
          WHERE id_bodega = $2 AND id_producto = $3
          `,
          [p.cantidad, idBodega, p.id_producto]
        );

        await client.query(
          `
          INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
          VALUES ($1, $2, 'SALIDA', $3, $4)
          `,
          [
            idBodega,
            p.id_producto,
            p.cantidad,
            `Venta #${idVenta} (panel colaborador)`,
          ]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        mensaje: "Venta registrada correctamente",
        id_venta: idVenta,
        total,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error al registrar la venta", detalle: String(error) },
      { status: 500 }
    );
  }
}
=======
// app/api/ventas/route.ts
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
    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.total,
        v.estado_venta,
        u.nombre,
        u.correo
      FROM venta v
      JOIN usuario u ON u.id_usuario = v.id_usuario
      ORDER BY v.fecha_venta DESC
    `);
    return NextResponse.json({ ventas: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar ventas", detalle: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
    }

    const total = items.reduce(
      (acc: number, item: { precio: number; cantidad: number }) =>
        acc + item.precio * item.cantidad,
      0
    );

    const ventaResult = await pool.query(
      `INSERT INTO venta (id_usuario, fecha_venta, total, estado_venta, tipo_venta, tipo_entrega, enlinea)
       VALUES ($1, NOW(), $2, 'PENDIENTE', 'MINORISTA', 'EN_TIENDA', true) RETURNING id_venta`,
      [usuario.id_usuario, total]
    );

    const id_venta = ventaResult.rows[0].id_venta;

    for (const item of items) {
      await pool.query(
        `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [id_venta, item.id_producto, item.cantidad, item.precio, item.precio * item.cantidad]
      );
    }

    return NextResponse.json({ ok: true, id_venta });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al registrar venta", detalle: String(error) },
      { status: 500 }
    );
  }
}
>>>>>>> feature/jose-facturacion-precios
