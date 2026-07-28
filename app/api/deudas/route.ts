import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

function esDueno(usuario: { tipo_usuario: string } | null) {
  return usuario?.tipo_usuario === TIPOS_USUARIO.DUENO;
}

type ProductoLinea = {
  id_producto: number;
  cantidad: number;
};

// GET /api/deudas — lista todas las deudas con sus productos
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(`
      SELECT
        d.id_deuda,
        d.nombre_deudor,
        d.telefono_deudor,
        d.fecha_inicio,
        d.monto_total,
        d.estado_deuda,
        d.fecha_creacion,
        COALESCE(
          json_agg(
            json_build_object(
              'id_producto', p.id_producto,
              'nombre_producto', p.nombre_producto,
              'cantidad', dp.cantidad,
              'precio_unitario', dp.precio_unitario,
              'subtotal', dp.subtotal
            ) ORDER BY p.nombre_producto
          ) FILTER (WHERE dp.id_producto IS NOT NULL),
          '[]'
        ) AS productos
      FROM deuda d
      LEFT JOIN deuda_producto dp ON dp.id_deuda = d.id_deuda
      LEFT JOIN producto p ON p.id_producto = dp.id_producto
      GROUP BY d.id_deuda
      ORDER BY d.estado_deuda ASC, d.fecha_inicio DESC, d.id_deuda DESC
    `);
    return NextResponse.json({ deudas: result.rows });
  } catch (error) {
    return apiError("DEUDAS GET", error);
  }
}

// POST /api/deudas — el dueño crea una nueva deuda con uno o varios productos
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!esDueno(usuario)) return unauthorizedError();

  const { nombre_deudor, telefono_deudor, fecha_inicio, productos } =
    await req.json();

  if (!nombre_deudor || !nombre_deudor.trim()) {
    return validationError("El nombre de la persona que debe es obligatorio");
  }
  if (!Array.isArray(productos) || productos.length === 0) {
    return validationError("Agregá al menos un producto a la deuda");
  }
  for (const linea of productos as ProductoLinea[]) {
    if (!linea.id_producto || !linea.cantidad || linea.cantidad <= 0) {
      return validationError("Cada producto necesita una cantidad válida (> 0)");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Trae el precio actual de cada producto involucrado
    const ids = (productos as ProductoLinea[]).map((p) => p.id_producto);
    const preciosRes = await client.query(
      `SELECT id_producto, precio_unitario FROM producto WHERE id_producto = ANY($1::int[])`,
      [ids]
    );
    const precios = new Map<number, number>(
      preciosRes.rows.map((r) => [r.id_producto, Number(r.precio_unitario)])
    );

    let montoTotal = 0;
    const lineas = (productos as ProductoLinea[]).map((linea) => {
      const precio = precios.get(linea.id_producto);
      if (precio === undefined) {
        throw new Error(`Producto ${linea.id_producto} no existe`);
      }
      const subtotal = Number((precio * linea.cantidad).toFixed(2));
      montoTotal += subtotal;
      return { ...linea, precio_unitario: precio, subtotal };
    });

    const deudaRes = await client.query(
      `INSERT INTO deuda (nombre_deudor, telefono_deudor, fecha_inicio, monto_total, id_usuario)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
       RETURNING *`,
      [
        nombre_deudor.trim(),
        telefono_deudor || null,
        fecha_inicio || null,
        Number(montoTotal.toFixed(2)),
        usuario!.id_usuario,
      ]
    );
    const deuda = deudaRes.rows[0];

    for (const linea of lineas) {
      await client.query(
        `INSERT INTO deuda_producto (id_deuda, id_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [deuda.id_deuda, linea.id_producto, linea.cantidad, linea.precio_unitario, linea.subtotal]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ deuda }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return apiError("DEUDAS POST", error);
  } finally {
    client.release();
  }
}
