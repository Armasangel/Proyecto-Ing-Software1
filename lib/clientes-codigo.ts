/**
 * Código de cliente: reglas compartidas entre el backend (validación) y el
 * frontend (búsqueda y etiqueta).
 *
 * El código es el identificador corto y legible con el que el negocio
 * reconoce a un cliente (carné, número de socio, etc.). Es único en la base
 * (constraint uq_cliente_codigo) y la comparación es insensible a
 * mayúsculas: al guardar siempre se normaliza a mayúsculas, así "cli-12" y
 * "CLI-12" son el mismo cliente.
 */

/** Tamaño máximo: el mismo que la columna cliente.codigo_cliente. */
export const CODIGO_CLIENTE_MAX = 20;

/** Prefijo de los códigos autogenerados por la secuencia cliente_codigo_seq. */
export const PREFIJO_CODIGO_CLIENTE = "CLI";

/** Letras, números, guion, punto y guion bajo. Sin espacios. */
const RE_CODIGO_CLIENTE = /^[A-Z0-9][A-Z0-9._-]*$/;

/** Recorta y pasa a mayúsculas. Cualquier valor que no sea string queda vacío. */
export function normalizarCodigoCliente(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.trim().toUpperCase();
}

/** "CLI-00007" a partir del número de la secuencia. */
export function formatearCodigoCliente(numero: number): string {
  return `${PREFIJO_CODIGO_CLIENTE}-${String(numero).padStart(5, "0")}`;
}

/**
 * ¿El código tiene un formato aceptable? (vacío NO es válido: se autogenera)
 * Se normaliza antes de validar, así "cli-12" también es válido.
 */
export function esCodigoClienteValido(codigo: string): boolean {
  const c = normalizarCodigoCliente(codigo);
  if (!c) return false;
  if (c.length > CODIGO_CLIENTE_MAX) return false;
  return RE_CODIGO_CLIENTE.test(c);
}

/** Texto de error para un código inválido (o null si el código es válido). */
export function errorCodigoCliente(codigo: string): string | null {
  const c = normalizarCodigoCliente(codigo);
  if (!c) return null;
  if (c.length > CODIGO_CLIENTE_MAX) {
    return `El código del cliente no puede superar los ${CODIGO_CLIENTE_MAX} caracteres`;
  }
  if (!RE_CODIGO_CLIENTE.test(c)) {
    return "El código del cliente solo puede tener letras, números, guiones, puntos o guiones bajos";
  }
  return null;
}
