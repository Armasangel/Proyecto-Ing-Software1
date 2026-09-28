/** Valores de `usuario.tipo_usuario` en la base de datos */
export const TIPOS_USUARIO = {
  DUENO: "DUENO",
  EMPLEADO: "EMPLEADO",
  BODEGUERO: "BODEGUERO"
} as const;

/**
 * Cantidad máxima de usuarios tipo DUENO permitidos en el sistema al mismo
 * tiempo. Un usuario solo puede volverse DUENO a través del proceso de
 * promoción con verificación por correo (ver app/api/usuarios/promover-dueno),
 * nunca creándose directamente como tal ni por una edición de rol normal —
 * esto evita que alguien escale privilegios sin que quede un rastro y un
 * paso extra de confirmación.
 */
export const MAX_DUENOS = 2;

export type TipoUsuarioDb = (typeof TIPOS_USUARIO)[keyof typeof TIPOS_USUARIO];

/** Dueño o colaborador de tienda (no incluye bodeguero, que tiene su propio panel). */
export function isStaffTipo(tipo: string): boolean {
  return tipo === TIPOS_USUARIO.DUENO || tipo === TIPOS_USUARIO.EMPLEADO;
}

export function isDuenoTipo(tipo: string): boolean {
  return tipo === TIPOS_USUARIO.DUENO;
}

/** Solo colaborador (empleado), no dueño — p. ej. módulo de ventas en tienda. */
export function isColaboradorTipo(tipo: string): boolean {
  return tipo === TIPOS_USUARIO.EMPLEADO;
}

/** Colaborador de bodega: registra entradas/salidas en su bodega asignada. */
export function isBodegueroTipo(tipo: string): boolean {
  return tipo === TIPOS_USUARIO.BODEGUERO;
}

export function labelRol(tipo: string): string {
  switch (tipo) {
    case TIPOS_USUARIO.DUENO:
      return "Dueño";
    case TIPOS_USUARIO.EMPLEADO:
      return "Colaborador";
    case TIPOS_USUARIO.BODEGUERO:
      return "Bodeguero";
    default:
      return tipo;
  }
}

export function postLoginPath(tipo: string): string {
  if (tipo === TIPOS_USUARIO.DUENO) return "/dashboard";
  if (tipo === TIPOS_USUARIO.EMPLEADO) return "/ventas";
  if (tipo === TIPOS_USUARIO.BODEGUERO) return "/bodega";
  return "/dashboard";
}

export type StaffShellVariant = "dueno" | "colaborador";

export function staffVariantFromTipo(tipo: string): StaffShellVariant {
  return tipo === TIPOS_USUARIO.DUENO ? "dueno" : "colaborador";
}
