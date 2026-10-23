import { TIPOS_USUARIO } from "@/lib/roles";
import type { NuevoUsuarioForm } from "@/lib/types/usuarios";

export const LIMITE_MAXIMO = 500;

export const TIPO_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  DUENO: {
    label: "Dueño",
    color: "var(--accent)",
    bg: "rgba(232,160,69,.15)",
    border: "rgba(232,160,69,.4)",
  },
  EMPLEADO: {
    label: "Colaborador",
    color: "var(--blue)",
    bg: "rgba(88,166,255,.12)",
    border: "rgba(88,166,255,.35)",
  },
  BODEGUERO: {
    label: "Bodeguero",
    color: "var(--green)",
    bg: "rgba(45,106,79,.15)",
    border: "rgba(45,106,79,.4)",
  },
};

export const TIPOS_OPCIONES: { value: string; label: string }[] = [
  { value: "", label: "Todos los roles" },
  { value: TIPOS_USUARIO.DUENO, label: "Dueño" },
  { value: TIPOS_USUARIO.EMPLEADO, label: "Colaborador" },
  { value: TIPOS_USUARIO.BODEGUERO, label: "Bodeguero" },
];

export const EMPTY_FORM: NuevoUsuarioForm = {
  nombre: "",
  correo: "",
  telefono: "",
  contrasena: "",
  tipo_usuario: TIPOS_USUARIO.EMPLEADO as string,
  id_bodega: "",
  requiere_2fa: true,
};

export function rolDescripcion(tipo: string): string {
  switch (tipo) {
    case "DUENO":
      return "Acceso total: inventario, reportes, estadísticas, usuarios";
    case "EMPLEADO":
      return "Panel de ventas, facturación, productos y bodegas";
    case "BODEGUERO":
      return "Registra entradas y salidas en su bodega asignada";
    default:
      return "";
  }
}
