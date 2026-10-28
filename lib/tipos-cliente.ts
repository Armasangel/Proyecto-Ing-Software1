/**
 * Tipos de cliente válidos (mismos valores que el CHECK de la tabla `cliente`
 * y de `descuento_asignacion` en migrations/11_cliente_datos_extra.sql).
 * Es la única fuente de verdad en el código: la API valida con `esTipoCliente`
 * y los <select> del frontend se llenan con `TIPOS_CLIENTE`.
 */
export const TIPOS_CLIENTE = ["MINORISTA", "MAYORISTA", "EMPRESA", "GOBIERNO"] as const;

export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export function esTipoCliente(valor: unknown): valor is TipoCliente {
  return typeof valor === "string" && (TIPOS_CLIENTE as readonly string[]).includes(valor);
}

/** "MINORISTA" -> "Minorista", "GOBIERNO" -> "Gobierno" (valor desconocido -> tal cual). */
export const ETIQUETAS_TIPO_CLIENTE: Record<TipoCliente, string> = {
  MINORISTA: "Minorista",
  MAYORISTA: "Mayorista",
  EMPRESA: "Empresa",
  GOBIERNO: "Gobierno",
};

export function etiquetaTipoCliente(valor: string | null | undefined): string {
  if (esTipoCliente(valor)) return ETIQUETAS_TIPO_CLIENTE[valor];
  return valor ?? "";
}
