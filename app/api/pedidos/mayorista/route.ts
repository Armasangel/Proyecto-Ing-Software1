// app/api/pedidos/mayorista/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

// Tipos internos

const ESTADOS_PEDIDO = ["PENDIENTE", "CONFIRMADO", "ENTREGADO", "CANCELADO"] as const;
type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

function isEstadoPedido(s: string): s is EstadoPedido {
  return (ESTADOS_PEDIDO as readonly string[]).includes(s);
}

// ─── GET — listar pedidos del mayorista autenticado, con filtros opcionales ───
//
// Query params soportados:
//   ?estado=PENDIENTE|CONFIRMADO|ENTREGADO|CANCELADO
//   ?desde=YYYY-MM-DD   (fecha inicio, inclusive)
//   ?hasta=YYYY-MM-DD   (fecha fin, inclusive)
//   ?id_bodega=N
//   ?q=texto            (busca en nombre de producto / código)
//   ?page=1             (paginación, default 1)
//   ?limit=20           (default 20, max 100)

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);

  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR_MAYOR) {
    return unauthorizedError();
  }

  const { searchParams } = req.nextUrl;

  const estado = searchParams.get("estado") ?? "";
  const desde = searchParams.get("desde") ?? "";
  const hasta = searchParams.get("hasta") ?? "";
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;

  // Validaciones suaves — estado desconocido simplemente se ignora
  const estadoFiltro = estado && isEstadoPedido(estado) ? estado : null;

  try {
    // Construimos la cláusula WHERE dinámicamente con parámetros posicionales
    const conditions: string[] = ["v.id_usuario = $1", "v.tipo_venta = 'MAYORISTA'"];
    const params: unknown[] = [usuario.id_usuario];
    let idx = 2;

    if (estadoFiltro) {
      conditions.push(`v.estado_venta = $${idx++}`);
      params.push(estadoFiltro);
    }

    if (desde) {
      conditions.push(`v.fecha_venta >= $${idx++}::date`);
      params.push(desde);
    }

    if (hasta) {
      conditions.push(`v.fecha_venta < ($${idx++}::date + INTERVAL '1 day')`);
      params.push(hasta);
    }

    if (q) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM detalle_venta dv2
          JOIN producto p2 ON p2.id_producto = dv2.id_producto
          WHERE dv2.id_venta = v.id_venta
            AND (
              p2.nombre_producto ILIKE $${idx}
              OR p2.codigo_producto ILIKE $${idx}
            )
        )`
      );
      params.push(`%${q}%`);
      idx++;
    }

    const where = conditions.join(" AND ");

    // Total para paginación
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM venta v WHERE ${where}`,
      params
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    // Datos principales
    const result = await pool.query(
      `
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.total,
        v.fecha_limite_pago,
        ue.nombre   AS nombre_colaborador,
        f.numero_factura,
        f.id_factura,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle',            dv.id_detalle_venta,
              'id_producto',           dv.id_producto,
              'codigo_producto',       p.codigo_producto,
              'nombre_producto',       p.nombre_producto,
              'unidad_medida',         p.unidad_medida,
              'cantidad',              dv.cantidad,
              'precio_unitario_venta', dv.precio_unitario,
              'subtotal',              dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      LEFT JOIN usuario       ue ON ue.id_usuario = v.id_empleado
      LEFT JOIN detalle_venta dv ON dv.id_venta   = v.id_venta
      LEFT JOIN producto       p ON p.id_producto  = dv.id_producto
      LEFT JOIN factura         f ON f.id_venta    = v.id_venta
      WHERE ${where}
      GROUP BY
        v.id_venta, v.fecha_venta, v.estado_venta, v.tipo_entrega,
        v.direccion_entrega, v.total, v.fecha_limite_pago,
        ue.nombre, f.numero_factura, f.id_factura
      ORDER BY v.fecha_venta DESC
      LIMIT $${idx} OFFSET $${idx + 1}
      `,
      [...params, limit, offset]
    );

    return NextResponse.json({
      pedidos: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filtros: {
        estado: estadoFiltro,
        desde: desde || null,
        hasta: hasta || null,
        q: q || null,
      },
    });
  } catch (error) {
    return apiError("PEDIDOS MAYORISTA GET", error);
  }
}

// POST — crear un nuevo pedido mayorista
//
// Body esperado:
// {
//   tipo_entrega: "EN_TIENDA" | "DOMICILIO",
//   direccion_entrega?: string,          // requerido si tipo_entrega = DOMICILIO
//   id_bodega: number,
//   lineas: [{ id_producto, cantidad, precio_unitario_venta }],
//   fecha_limite_pago?: string           // YYYY-MM-DD, opcional
// }

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);

  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR_MAYOR) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const { tipo_entrega, direccion_entrega, id_bodega, lineas, fecha_limite_pago } = body;

    // Validaciones básicas 

    if (!["EN_TIENDA", "DOMICILIO"].includes(tipo_entrega)) {
      return validationError("tipo_entrega debe ser EN_TIENDA o DOMICILIO");
    }

    const direccion =
      typeof direccion_entrega === "string" ? direccion_entrega.trim() : "";
    if (tipo_entrega === "DOMICILIO" && !direccion) {
      return validationError("La dirección de entrega es obligatoria para pedidos a domicilio");
    }

    const idBodega = Number(id_bodega);
    if (!idBodega || idBodega < 1) {
      return validationError("id_bodega inválido");
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return validationError("El pedido debe contener al menos un producto");
    }

    // Normalizar y validar líneas
    type LineaNorm = { id_producto: number; cantidad: number; precio: number; subtotal: number };
    const lineasNorm: LineaNorm[] = [];

    for (const raw of lineas as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const id_producto = Number(o.id_producto);
      const cantidad = Number(o.cantidad);
      const precio = Number(o.precio_unitario_venta);

      if (!id_producto || cantidad <= 0 || precio < 0) {
        return validationError(
          "Cada línea requiere id_producto válido, cantidad > 0 y precio >= 0"
        );
      }
      lineasNorm.push({ id_producto, cantidad, precio, subtotal: 0 });
    }

    if (lineasNorm.length === 0) {
      return validationError("No se recibieron líneas de pedido válidas");
    }

    let fechaLimite: string | null = null;
    if (fecha_limite_pago != null && String(fecha_limite_pago).trim() !== "") {
      fechaLimite = String(fecha_limite_pago).trim();
    }

    // Transacción 

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verificar bodega
      const bodegaQ = await client.query(
        `SELECT 1 FROM bodega WHERE id_bodega = $1`,
        [idBodega]
      );
      if (bodegaQ.rowCount === 0) {
        await client.query("ROLLBACK");
        return validationError("Bodega no encontrada");
      }

      // Calcular subtotales y verificar stock + estado del producto
      let total = 0;
      const prepared: LineaNorm[] = [];

      for (const ln of lineasNorm) {
        // Verificar producto activo
        const prodQ = await client.query(
          `SELECT id_producto, nombre_producto, precio_mayoreo, estado_producto
           FROM producto WHERE id_producto = $1`,
          [ln.id_producto]
        );
        if (prodQ.rowCount === 0 || !prodQ.rows[0].estado_producto) {
          await client.query("ROLLBACK");
          return validationError(`Producto id ${ln.id_producto} no disponible`);
        }

        // Verificar stock en bodega
        const stockQ = await client.query(
          `SELECT cantidad_disponible
           FROM bodega_producto
           WHERE id_bodega = $1 AND id_producto = $2`,
          [idBodega, ln.id_producto]
        );
        const disponible =
          stockQ.rowCount && stockQ.rows[0]
            ? Number(stockQ.rows[0].cantidad_disponible)
            : 0;
        if (disponible < ln.cantidad) {
          await client.query("ROLLBACK");
          return validationError(
            `Stock insuficiente para producto id ${ln.id_producto} (disponible: ${disponible})`
          );
        }

        const subQ = await client.query(
          `SELECT ROUND(($1::numeric * $2::numeric), 2) AS sub`,
          [ln.cantidad, ln.precio]
        );
        const subtotal = Number(subQ.rows[0].sub);
        total += subtotal;
        prepared.push({ ...ln, subtotal });
      }

      const totalRounded = Math.round(total * 100) / 100;

      // Insertar venta
      const ventaQ = await client.query(
        `INSERT INTO venta (
          id_usuario, estado_venta, tipo_venta, tipo_entrega,
          direccion_entrega, enlinea, total, fecha_limite_pago
        )
        VALUES ($1, 'PENDIENTE', 'MAYORISTA', $2, $3, TRUE, $4, $5)
        RETURNING id_venta`,
        [
          usuario.id_usuario,
          tipo_entrega,
          tipo_entrega === "EN_TIENDA" ? null : direccion || null,
          totalRounded,
          fechaLimite,
        ]
      );
      const idVenta = ventaQ.rows[0].id_venta as number;

      // Insertar detalles, descontar stock y registrar kardex
      for (const p of prepared) {
        await client.query(
          `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [idVenta, p.id_producto, p.cantidad, p.precio, p.subtotal]
        );

        await client.query(
          `UPDATE bodega_producto
           SET cantidad_disponible = cantidad_disponible - $1,
               ultima_actualizacion = NOW()
           WHERE id_bodega = $2 AND id_producto = $3`,
          [p.cantidad, idBodega, p.id_producto]
        );

        await client.query(
          `INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
           VALUES ($1, $2, 'SALIDA', $3, $4)`,
          [idBodega, p.id_producto, p.cantidad, `Pedido mayorista #${idVenta} (en línea)`]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json(
        {
          ok: true,
          id_venta: idVenta,
          total: totalRounded,
          mensaje: "Pedido mayorista registrado correctamente",
        },
        { status: 201 }
      );
    } catch (error) {
      await client.query("ROLLBACK");
      return apiError("PEDIDOS MAYORISTA POST - tx", error);
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError("PEDIDOS MAYORISTA POST - parse", error);
  }
}