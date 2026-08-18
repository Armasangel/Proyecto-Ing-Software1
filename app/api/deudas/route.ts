import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { recalcularBloqueoCliente, verificarLimiteAntesDeDeuda } from "@/lib/deuda-alertas";

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
        d.fecha_limite_pago,
        d.monto_total,
        d.estado_deuda,
        d.fecha_creacion,
        d.id_cliente,
        c.limite_deuda,
        c.estado_cliente AS cliente_puede_comprar,
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
      LEFT JOIN cliente c ON c.id_cliente = d.id_cliente
      GROUP BY d.id_deuda, c.limite_deuda, c.estado_cliente
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

  const {
    nombre_deudor,
    telefono_deudor,
    fecha_inicio,
    fecha_limite_pago,
    productos,
    id_cliente,
    monto_libre,
  } = await req.json();

  if (!nombre_deudor || !nombre_deudor.trim()) {
    return validationError("El nombre de la persona que debe es obligatorio");
  }
  const idClienteNum: number | null =
    id_cliente === undefined || id_cliente === null || id_cliente === ""
      ? null
      : Number(id_cliente);
  if (idClienteNum !== null && !Number.isInteger(idClienteNum)) {
    return validationError("id_cliente inválido");
  }

  // monto_libre: deuda inicial "de arrastre" (ej. al registrar un cliente que
  // ya venía debiendo), sin desglose por producto. Alternativa a `productos`.
  const tieneProductos = Array.isArray(productos) && productos.length > 0;
  const montoLibreNum: number | null =
    monto_libre === undefined || monto_libre === null || monto_libre === ""
      ? null
      : Number(monto_libre);

  if (!tieneProductos && montoLibreNum === null) {
    return validationError("Agrega al menos un producto o un monto inicial de deuda");
  }
  if (montoLibreNum !== null && (!Number.isFinite(montoLibreNum) || montoLibreNum <= 0)) {
    return validationError("El monto inicial de deuda debe ser mayor a 0");
  }
  if (tieneProductos) {
    for (const linea of productos as ProductoLinea[]) {
      if (!linea.id_producto || !linea.cantidad || linea.cantidad <= 0) {
        return validationError("Cada producto necesita una cantidad válida (> 0)");
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (idClienteNum !== null) {
      const existeCliente = await client.query(
        `SELECT 1 FROM cliente WHERE id_cliente = $1`,
        [idClienteNum]
      );
      if (existeCliente.rowCount === 0) {
        await client.query("ROLLBACK");
        return validationError("El cliente vinculado no existe");
      }
    }

    // Trae el precio actual de cada producto involucrado (si aplica)
    let montoTotal = 0;
    let lineas: Array<ProductoLinea & { precio_unitario: number; subtotal: number }> = [];

    if (tieneProductos) {
      const ids = (productos as ProductoLinea[]).map((p) => p.id_producto);
      const preciosRes = await client.query(
        `SELECT id_producto, precio_unitario FROM producto WHERE id_producto = ANY($1::int[])`,
        [ids]
      );
      const precios = new Map<number, number>(
        preciosRes.rows.map((r) => [r.id_producto, Number(r.precio_unitario)])
      );

      lineas = (productos as ProductoLinea[]).map((linea) => {
        const precio = precios.get(linea.id_producto);
        if (precio === undefined) {
          throw new Error(`Producto ${linea.id_producto} no existe`);
        }
        const subtotal = Number((precio * linea.cantidad).toFixed(2));
        montoTotal += subtotal;
        return { ...linea, precio_unitario: precio, subtotal };
      });
    } else if (montoLibreNum !== null) {
      montoTotal = montoLibreNum;
    }

    // Antes de registrar la deuda, si está ligada a un cliente y es por
    // productos (compra nueva, no un monto_libre de arrastre), verificamos
    // que el cliente no esté ya bloqueado y que esta deuda no lo lleve a
    // alcanzar o superar su límite. El monto_libre queda exento porque se usa
    // para registrar deuda ya existente (ej. un cliente que se da de alta
    // con deuda previa), que puede legítimamente ya superar el límite recién
    // asignado.
    if (idClienteNum !== null && tieneProductos) {
      const verificacion = await verificarLimiteAntesDeDeuda(client, idClienteNum, montoTotal);
      if (!verificacion.permitido) {
        await client.query("ROLLBACK");
        return validationError(verificacion.motivo || "No se puede registrar esta deuda.");
      }
    }

    const deudaRes = await client.query(
      `INSERT INTO deuda (nombre_deudor, telefono_deudor, fecha_inicio, fecha_limite_pago, monto_total, id_usuario, id_cliente)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [
        nombre_deudor.trim(),
        telefono_deudor || null,
        fecha_inicio || null,
        fecha_limite_pago || null,
        Number(montoTotal.toFixed(2)),
        usuario!.id_usuario,
        idClienteNum,
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

    // Si la deuda está vinculada a un cliente, recalcula su deuda pendiente
    // total y bloquea/desbloquea sus compras según su límite individual.
    let alerta: Awaited<ReturnType<typeof recalcularBloqueoCliente>> | null = null;
    if (idClienteNum !== null) {
      alerta = await recalcularBloqueoCliente(client, idClienteNum);
    }

    await client.query("COMMIT");
    return NextResponse.json({ deuda, alerta }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return apiError("DEUDAS POST", error);
  } finally {
    client.release();
  }
}