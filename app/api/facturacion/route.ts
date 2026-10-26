// app/api/facturacion/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError, tooManyRequestsError } from "@/lib/api-error";
import { rateLimit, getClientKey } from "@/lib/rateLimit";
import { esTipoDocumento, prefijoTipoDocumento, type TipoDocumento } from "@/lib/tipos-documento";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.fecha_venta,
        v.total,
        v.estado_venta,
        c.nombre,
        c.correo,
        c.codigo_cliente,
        c.nit_cliente,
        f.id_factura,
        f.numero_factura,
        f.tipo_documento,
        f.direccion_cliente,
        f.total_factura
      FROM venta v
      JOIN cliente c ON c.id_cliente = v.id_cliente
      LEFT JOIN factura f ON f.id_venta = v.id_venta
      ORDER BY v.fecha_venta DESC
    `);
    return NextResponse.json({ ventas: result.rows });
  } catch (error) {
    return apiError("FACTURACION GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  // tasa limite: 10 solicitudes por minuto por usuario
  const { allowed, retryAfter } = rateLimit(
    getClientKey(req, `facturacion:post:${usuario.id_usuario}`),
    10,
    60_000
  );

  if (!allowed) {
    return tooManyRequestsError(retryAfter ?? 60_000);
  }

  try {
    const { id_venta, tipo_documento } = await req.json();

    if (!id_venta) {
      return validationError("id_venta es requerido");
    }

    const tipoDocumento: TipoDocumento =
      tipo_documento === undefined || tipo_documento === null
        ? "FACTURA"
        : tipo_documento;
    if (!esTipoDocumento(tipoDocumento)) {
      return validationError("tipo_documento debe ser FACTURA o FACTURA_CAMBIARIA");
    }

    // Los datos del documento salen del cliente guardado, no del body: así la
    // factura cambiaria siempre usa el NIT y la dirección ampliados reales.
    const venta = await pool.query(
      `SELECT v.total, c.nombre, c.nit_cliente, c.direccion
       FROM venta v
       JOIN cliente c ON c.id_cliente = v.id_cliente
       WHERE v.id_venta = $1`,
      [id_venta]
    );

    if (venta.rows.length === 0) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    const cliente = venta.rows[0];
    const nombreCliente = cliente.nombre || "Consumidor Final";
    const nitCliente = (cliente.nit_cliente || "CF").trim() || "CF";
    const direccionCliente =
      typeof cliente.direccion === "string" ? cliente.direccion.trim() : "";

    if (tipoDocumento === "FACTURA_CAMBIARIA") {
      if (nitCliente.toUpperCase() === "CF") {
        return validationError(
          "La factura cambiaria requiere que el cliente tenga un NIT registrado"
        );
      }
      if (!direccionCliente) {
        return validationError(
          "La factura cambiaria requiere que el cliente tenga una dirección registrada"
        );
      }
    }

    const facturaResult = await pool.query(
      `INSERT INTO factura
         (id_venta, numero_factura, tipo_documento, nombre_cliente, nit_cliente,
          direccion_cliente, total_factura)
       VALUES ($1, $2 || '-' || LPAD(nextval('factura_numero_seq')::text, 6, '0'),
               $3, $4, $5, $6, $7)
       RETURNING id_factura, numero_factura`,
      [
        id_venta,
        prefijoTipoDocumento(tipoDocumento),
        tipoDocumento,
        nombreCliente,
        nitCliente,
        direccionCliente || null,
        venta.rows[0].total,
      ]
    );

    await pool.query(
      `UPDATE venta SET estado_venta = 'CONFIRMADO' WHERE id_venta = $1`,
      [id_venta]
    );

    return NextResponse.json({
      ok: true,
      id_factura: facturaResult.rows[0].id_factura,
      numero_factura: facturaResult.rows[0].numero_factura,
      tipo_documento: tipoDocumento,
      nombre_cliente: nombreCliente,
      nit_cliente: nitCliente,
      direccion_cliente: direccionCliente || null,
    });
  } catch (error) {
    return apiError("FACTURACION POST", error);
  }
}
