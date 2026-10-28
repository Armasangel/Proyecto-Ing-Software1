import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { recalcularBloqueoCliente } from "@/lib/deuda-alertas";

// PATCH /api/clientes/:id — el dueño define el límite de deuda individual
// del cliente (limite_deuda: number | null, null = sin límite).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
    return unauthorizedError();
  }

  const { id } = await params;
  const id_cliente = Number(id);
  if (!Number.isInteger(id_cliente)) {
    return validationError("Id de cliente inválido");
  }

  const { limite_deuda } = await req.json();
  let limiteNum: number | null = null;
  if (limite_deuda !== null && limite_deuda !== undefined && limite_deuda !== "") {
    limiteNum = Number(limite_deuda);
    if (!Number.isFinite(limiteNum) || limiteNum < 0) {
      return validationError("El límite de crédito debe ser un número mayor o igual a 0");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existe = await client.query<{ es_consumidor_final: boolean }>(
      `SELECT es_consumidor_final FROM cliente WHERE id_cliente = $1`,
      [id_cliente]
    );
    if (existe.rowCount === 0) {
      await client.query("ROLLBACK");
      return validationError("El cliente no existe");
    }

    // Consumidor Final nunca debe quedar bloqueado por deuda: no se le
    // asigna (ni se le quita) límite de crédito desde esta ruta.
    if (existe.rows[0].es_consumidor_final) {
      await client.query("ROLLBACK");
      return validationError("El cliente Consumidor Final no puede tener límite de crédito");
    }

    await client.query(`UPDATE cliente SET limite_deuda = $1 WHERE id_cliente = $2`, [
      limiteNum,
      id_cliente,
    ]);

    // El nuevo límite puede des-bloquear o bloquear al cliente de inmediato
    // según su deuda pendiente actual.
    const alerta = await recalcularBloqueoCliente(client, id_cliente);

    await client.query("COMMIT");
    return NextResponse.json({ alerta });
  } catch (error) {
    await client.query("ROLLBACK");
    return apiError("CLIENTES PATCH", error);
  } finally {
    client.release();
  }
}