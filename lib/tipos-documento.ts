/**
 * Tipos de documento de facturación válidos (mismos valores que el CHECK de
 * factura.tipo_documento en migrations/13_factura_cambiaria.sql).
 * Es la única fuente de verdad en el código: la API valida con
 * `esTipoDocumento` y los <select> del frontend se llenan con TIPOS_DOCUMENTO.
 */
export const TIPOS_DOCUMENTO = ["FACTURA", "FACTURA_CAMBIARIA"] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export function esTipoDocumento(valor: unknown): valor is TipoDocumento {
  return typeof valor === "string" && (TIPOS_DOCUMENTO as readonly string[]).includes(valor);
}

/** "FACTURA" -> "Factura", "FACTURA_CAMBIARIA" -> "Factura cambiaria". */
export const ETIQUETAS_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  FACTURA: "Factura",
  FACTURA_CAMBIARIA: "Factura cambiaria",
};

/** Prefijo del número correlativo de cada tipo de documento. */
export const PREFIJOS_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  FACTURA: "FACT",
  FACTURA_CAMBIARIA: "FCAM",
};

export function etiquetaTipoDocumento(valor: string | null | undefined): string {
  if (esTipoDocumento(valor)) return ETIQUETAS_TIPO_DOCUMENTO[valor];
  return valor ?? "";
}

export function prefijoTipoDocumento(valor: string | null | undefined): string {
  if (esTipoDocumento(valor)) return PREFIJOS_TIPO_DOCUMENTO[valor];
  return PREFIJOS_TIPO_DOCUMENTO.FACTURA;
}
