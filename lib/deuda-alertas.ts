// lib/deuda-alertas.ts
// Recalcula la deuda pendiente total de un cliente vinculado y, según su
// limite_deuda individual, bloquea o desbloquea sus compras/pedidos
// (reutilizando cliente.estado_cliente, ya usado como gate en
// app/api/ventas/route.ts y app/api/ordenes/route.ts).
//
// IMPORTANTE: estado_cliente es un solo flag booleano, sin "motivo". Si en el
// futuro el dueño desactiva un cliente por otra razón (no deuda), esta
// función lo reactivaría solo al bajar la deuda. Si eso importa, habría que
// agregar una columna aparte (ej. bloqueado_por_deuda) para no pisar un
// bloqueo manual — se dejó fuera de esta primera versión para no sobrecargar
// el modelo.

import { PoolClient } from "pg";

export type ResultadoAlertaDeuda = {
  id_cliente: number;
  deuda_pendiente: number;
  limite_deuda: number | null;
  bloqueado: boolean;
  cambioEstado: boolean; // true si esta llamada cambió estado_cliente
};

export async function recalcularBloqueoCliente(
  client: PoolClient,
  id_cliente: number
): Promise<ResultadoAlertaDeuda> {
  const clienteRes = await client.query(
    `SELECT limite_deuda, estado_cliente FROM cliente WHERE id_cliente = $1 FOR UPDATE`,
    [id_cliente]
  );
  if (clienteRes.rowCount === 0) {
    throw new Error(`Cliente ${id_cliente} no existe`);
  }
  const limite: number | null =
    clienteRes.rows[0].limite_deuda === null ? null : Number(clienteRes.rows[0].limite_deuda);
  const estadoActual: boolean = clienteRes.rows[0].estado_cliente;

  const sumaRes = await client.query(
    `SELECT COALESCE(SUM(monto_total), 0) AS total
     FROM deuda
     WHERE id_cliente = $1 AND estado_deuda = 'PENDIENTE'`,
    [id_cliente]
  );
  const deudaPendiente = Number(sumaRes.rows[0].total);

  const debeBloquear = limite !== null && limite > 0 && deudaPendiente >= limite;
  const nuevoEstado = !debeBloquear; // estado_cliente = TRUE significa "puede comprar"
  const cambioEstado = nuevoEstado !== estadoActual;

  if (cambioEstado) {
    await client.query(`UPDATE cliente SET estado_cliente = $1 WHERE id_cliente = $2`, [
      nuevoEstado,
      id_cliente,
    ]);
  }

  return {
    id_cliente,
    deuda_pendiente: deudaPendiente,
    limite_deuda: limite,
    bloqueado: debeBloquear,
    cambioEstado,
  };
}