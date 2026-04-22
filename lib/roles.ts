/** Valores de `usuario.tipo_usuario` en la base de datos */
export const TIPOS_USUARIO = {
  DUENO: "DUENO",
  EMPLEADO: "EMPLEADO",
  COMPRADOR: "COMPRADOR",
  COMPRADOR_MAYOR: "COMPRADOR_MAYOR",
} as const;

export type TipoUsuarioDb = (typeof TIPOS_USUARIO)[keyof typeof TIPOS_USUARIO];

export function isStaffTipo(tipo: string): boolean {
  return tipo === TIPOS_USUARIO.DUENO || tipo === TIPOS_USUARIO.EMPLEADO;
}

/** Solo colaborador (empleado), no dueño — p. ej. módulo de ventas en tienda. */
export function isColaboradorTipo(tipo: string): boolean {
  return tipo === TIPOS_USUARIO.EMPLEADO;
}

export function labelRol(tipo: string): string {
  switch (tipo) {
    case TIPOS_USUARIO.DUENO:
      return "Dueño";
    case TIPOS_USUARIO.EMPLEADO:
      return "Colaborador";
    case TIPOS_USUARIO.COMPRADOR:
      return "Comprador";
    case TIPOS_USUARIO.COMPRADOR_MAYOR:
      return "Comprador mayorista";
    default:
      return tipo;
  }
}

export function postLoginPath(tipo: string): string {
  if (tipo === TIPOS_USUARIO.COMPRADOR) return "/tienda";
  if (tipo === TIPOS_USUARIO.COMPRADOR_MAYOR) return "/mayoreo";
  return "/dashboard";
}

export type StaffShellVariant = "dueno" | "colaborador";

export function staffVariantFromTipo(tipo: string): StaffShellVariant {
  return tipo === TIPOS_USUARIO.DUENO ? "dueno" : "colaborador";
}
