import { Pool, PoolClient } from "pg";

export const METODOS_PAGO = ["TARJETA", "EFECTIVO", "TRANSFERENCIA"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export function isMetodoPago(s: string): s is MetodoPago {
  return (METODOS_PAGO as readonly string[]).includes(s);
}

export type SaldoVenta = {
  id_venta: number;
  total: number;
  total_pagado: number;
  deuda_pendiente: number;
  estado_venta: string;
};

export async function getSaldoVenta(
  client: Pool | PoolClient,
  id_venta: number
): Promise<SaldoVenta | null> {
  const r = await client.query(
    `SELECT
       v.id_venta,
       v.total::float8 AS total,
       v.estado_venta,
       COALESCE(SUM(p.monto), 0)::float8 AS total_pagado
     FROM venta v
     LEFT JOIN pago p ON p.id_venta = v.id_venta
     WHERE v.id_venta = $1 AND v.estado_venta != 'CANCELADO'
     GROUP BY v.id_venta, v.total, v.estado_venta`,
    [id_venta]
  );
  if (r.rows.length === 0) return null;

  const row = r.rows[0];
  const total = Number(row.total);
  const total_pagado = Number(row.total_pagado);

  return {
    id_venta: row.id_venta,
    total,
    total_pagado,
    deuda_pendiente: Math.max(0, total - total_pagado),
    estado_venta: row.estado_venta,
  };
}

export async function recalcularEstadoVenta(
  client: Pool | PoolClient,
  id_venta: number
): Promise<void> {
  const saldo = await getSaldoVenta(client, id_venta);
  if (!saldo) return;

  if (saldo.deuda_pendiente <= 0) {
    await client.query(
      `UPDATE venta SET estado_venta = 'PAGADO' WHERE id_venta = $1`,
      [id_venta]
    );
  } else if (saldo.estado_venta === "PAGADO") {
    await client.query(
      `UPDATE venta SET estado_venta = 'ENTREGADO' WHERE id_venta = $1`,
      [id_venta]
    );
  }
}

export async function registrarPago(
  pool: Pool,
  params: { id_venta: number; monto: number; metodo: MetodoPago }
): Promise<{ id_pago: number; deuda_pendiente: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const saldo = await getSaldoVenta(client, params.id_venta);
    if (!saldo) throw new Error("VENTA_NOT_FOUND");
    if (params.monto <= 0) throw new Error("MONTO_INVALIDO");
    if (params.monto > saldo.deuda_pendiente + 0.001) {
      throw new Error("MONTO_EXCEDE_DEUDA");
    }

    const ins = await client.query(
      `INSERT INTO pago (id_venta, monto, metodo) VALUES ($1, $2, $3) RETURNING id_pago`,
      [params.id_venta, params.monto, params.metodo]
    );

    await recalcularEstadoVenta(client, params.id_venta);
    await client.query("COMMIT");

    const updated = await getSaldoVenta(pool, params.id_venta);
    return {
      id_pago: ins.rows[0].id_pago as number,
      deuda_pendiente: updated?.deuda_pendiente ?? 0,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function actualizarPago(
  pool: Pool,
  id_pago: number,
  monto: number
): Promise<{ id_venta: number; deuda_pendiente: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pagoRow = await client.query(
      `SELECT id_pago, id_venta, monto FROM pago WHERE id_pago = $1`,
      [id_pago]
    );
    if (pagoRow.rows.length === 0) throw new Error("PAGO_NOT_FOUND");

    const id_venta = pagoRow.rows[0].id_venta as number;
    if (monto <= 0) throw new Error("MONTO_INVALIDO");

    const saldo = await getSaldoVenta(client, id_venta);
    if (!saldo) throw new Error("VENTA_NOT_FOUND");

    const montoAnterior = Number(pagoRow.rows[0].monto);
    const nuevoTotalPagado = saldo.total_pagado - montoAnterior + monto;
    if (nuevoTotalPagado > saldo.total + 0.001) {
      throw new Error("MONTO_EXCEDE_DEUDA");
    }

    await client.query(`UPDATE pago SET monto = $1 WHERE id_pago = $2`, [
      monto,
      id_pago,
    ]);
    await recalcularEstadoVenta(client, id_venta);
    await client.query("COMMIT");

    const updated = await getSaldoVenta(pool, id_venta);
    return {
      id_venta,
      deuda_pendiente: updated?.deuda_pendiente ?? 0,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
