import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { recalcularBloqueoCliente } from "@/lib/deuda-alertas";

// POST /api/deudas/:id/pagos — registra un abono parcial (o total) contra
// una deuda. Si el abono cubre el saldo restante, la deuda pasa a PAGADA
// automáticamente. Cualquier miembro del staff puede registrar un pago
// (igual que el toggle de estado en /api/deudas/[id]), ya que en la
// práctica es el empleado o el dueño quien recibe el dinero en caja.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const id_deuda = Number(params.id);
  if (!Number.isInteger(id_deuda)) {
    return validationError("Id de deuda inválido");
  }

  const { monto, metodo_pago, nota } = await req.json();
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    return validationError("El monto del pago debe ser mayor a 0");
  }
  if (metodo_pago !== undefined && metodo_pago !== null && typeof metodo_pago !== "string") {
    return validationError("metodo_pago inválido");
  }
  if (nota !== undefined && nota !== null && typeof nota !== "string") {
    return validationError("nota inválida");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deudaRes = await client.query(
      `SELECT id_deuda, monto_total, estado_deuda, id_cliente
       FROM deuda WHERE id_deuda = $1 FOR UPDATE`,
      [id_deuda]
    );
    if (deudaRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return validationError("La deuda no existe");
    }
    const deuda = deudaRes.rows[0];

    if (deuda.estado_deuda === "PAGADA") {
      await client.query("ROLLBACK");
      return validationError("Esta deuda ya está marcada como pagada");
    }

    const pagadoRes = await client.query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM pago_deuda WHERE id_deuda = $1`,
      [id_deuda]
    );
    const totalPagadoActual = Number(pagadoRes.rows[0].total);
    const montoTotal = Number(deuda.monto_total);
    const saldoActual = Math.round((montoTotal - totalPagadoActual) * 100) / 100;

    // Tolerancia de 1 centavo por redondeo en punto flotante.
    if (montoNum > saldoActual + 0.01) {
      await client.query("ROLLBACK");
      return validationError(
        `El pago (Q${montoNum.toFixed(2)}) es mayor al saldo pendiente (Q${saldoActual.toFixed(2)}).`
      );
    }

    const pagoRes = await client.query(
      `INSERT INTO pago_deuda (id_deuda, monto, id_usuario, metodo_pago, nota)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id_deuda, Number(montoNum.toFixed(2)), usuario!.id_usuario, metodo_pago || null, nota || null]
    );

    const nuevoSaldo = Math.round((saldoActual - montoNum) * 100) / 100;
    let nuevoEstado = deuda.estado_deuda;
    if (nuevoSaldo <= 0.01) {
      nuevoEstado = "PAGADA";
      await client.query(`UPDATE deuda SET estado_deuda = 'PAGADA' WHERE id_deuda = $1`, [id_deuda]);
    }

    let alerta: Awaited<ReturnType<typeof recalcularBloqueoCliente>> | null = null;
    if (deuda.id_cliente !== null) {
      alerta = await recalcularBloqueoCliente(client, deuda.id_cliente);
    }

    await client.query("COMMIT");
    return NextResponse.json(
      {
        pago: pagoRes.rows[0],
        saldo_pendiente: Math.max(nuevoSaldo, 0),
        estado_deuda: nuevoEstado,
        alerta,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return apiError("DEUDAS PAGOS POST", error);
  } finally {
    client.release();
  }
}
