import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { esTipoCliente } from "@/lib/tipos-cliente";
import { errorCodigoCliente, normalizarCodigoCliente } from "@/lib/clientes-codigo";

// Límites de las columnas nuevas (mismos tamaños que la tabla cliente).
const NIT_MAX = 20;
const CODIGO_POSTAL_MAX = 10;
const DIRECCION_MAX = 255;

/** Trim de strings: cualquier cosa que no sea string queda como cadena vacía. */
function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

// Esta ruta se consulta desde Ventas/Pedidos para saber si un cliente está
// bloqueado por deuda — nunca debe servirse cacheada (ni por el navegador ni
// por Next), o un colaborador podría ver la lista desactualizada.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  // ?todos=1 incluye también clientes bloqueados (estado_cliente = FALSE) y su
  // límite de deuda — lo usa la página de deudas para vincular/gestionar
  // clientes que ya están bloqueados. Las páginas de ventas/ordenes NO mandan
  // este parámetro, así que siguen viendo solo clientes activos como antes.
  const incluirTodos = req.nextUrl.searchParams.get("todos") === "1";

  // ?codigo=CLI-00001 busca un cliente puntual por su código. La comparación
  // es insensible a mayúsculas porque los códigos se guardan normalizados
  // (ver lib/clientes-codigo.ts).
  const codigo = normalizarCodigoCliente(req.nextUrl.searchParams.get("codigo"));

  try {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (!incluirTodos) condiciones.push("estado_cliente = TRUE");
    if (codigo) {
      params.push(codigo);
      condiciones.push(`UPPER(codigo_cliente) = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT id_cliente, nombre, correo, telefono, tipo_cliente, estado_cliente, limite_deuda,
              es_consumidor_final, nit_cliente, codigo_postal, direccion, codigo_cliente
       FROM cliente
       ${where}
       ORDER BY nombre`,
      params
    );
    return NextResponse.json(
      { clientes: result.rows },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    return apiError("CLIENTES GET", error);
  }
}

// POST /api/clientes — crea un cliente nuevo (ej. desde el flujo de "vincular
// a un cliente" en Deudas, cuando la persona todavía no está registrada).
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const {
    nombre,
    correo,
    telefono,
    tipo_cliente,
    limite_deuda,
    nit_cliente,
    codigo_postal,
    direccion,
    codigo_cliente,
  } = await req.json();

  if (!nombre || !nombre.trim()) {
    return validationError("El nombre del cliente es obligatorio");
  }
  // Tipo fuera de la lista válida (o ausente) -> MINORISTA, igual que antes.
  const tipoFinal = esTipoCliente(tipo_cliente) ? tipo_cliente : "MINORISTA";

  // NIT/código postal/dirección son opcionales: sin NIT se guarda 'CF'
  // (Consumidor Final), igual que el DEFAULT de la columna.
  const nitFinal = texto(nit_cliente) || "CF";
  const codigoPostalFinal = texto(codigo_postal);
  const direccionFinal = texto(direccion);
  if (nitFinal.length > NIT_MAX) {
    return validationError(`El NIT no puede superar los ${NIT_MAX} caracteres`);
  }
  if (codigoPostalFinal.length > CODIGO_POSTAL_MAX) {
    return validationError(`El código postal no puede superar los ${CODIGO_POSTAL_MAX} caracteres`);
  }
  if (direccionFinal.length > DIRECCION_MAX) {
    return validationError(`La dirección no puede superar los ${DIRECCION_MAX} caracteres`);
  }

  // El código es opcional: si el colaborador no escribe uno, la base genera
  // el siguiente correlativo (CLI-00007, CLI-00008, ...). Si escribe uno se
  // normaliza a mayúsculas para que "cli-12" y "CLI-12" sean el mismo.
  const codigoFinal = normalizarCodigoCliente(codigo_cliente);
  const errorCodigo = errorCodigoCliente(codigoFinal);
  if (errorCodigo) {
    return validationError(errorCodigo);
  }

  let limiteNum: number | null = null;
  if (limite_deuda !== null && limite_deuda !== undefined && limite_deuda !== "") {
    limiteNum = Number(limite_deuda);
    if (!Number.isFinite(limiteNum) || limiteNum < 0) {
      return validationError("El límite de crédito debe ser un número mayor o igual a 0");
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO cliente (nombre, correo, telefono, tipo_cliente, limite_deuda, nit_cliente, codigo_postal, direccion, codigo_cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               CASE WHEN $9 = '' THEN (SELECT 'CLI-' || LPAD(nextval('cliente_codigo_seq')::text, 5, '0'))
                    ELSE $9 END)
       RETURNING id_cliente, nombre, correo, telefono, tipo_cliente, estado_cliente, limite_deuda,
                 es_consumidor_final, nit_cliente, codigo_postal, direccion, codigo_cliente`,
      [nombre.trim(), correo || null, telefono || null, tipoFinal, limiteNum, nitFinal, codigoPostalFinal || null, direccionFinal || null, codigoFinal]
    );
    return NextResponse.json({ cliente: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      if (error?.constraint === "uq_cliente_codigo") {
        return validationError("Ya existe un cliente con ese código");
      }
      // uq_cliente_correo
      return validationError("Ya existe un cliente registrado con ese correo");
    }
    return apiError("CLIENTES POST", error);
  }
}