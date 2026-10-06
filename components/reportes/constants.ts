import type { PeriodoKey } from "./types";

export const PERIODOS: { value: PeriodoKey; label: string }[] = [
  { value: "day",     label: "Hoy" },
  { value: "week",    label: "7 días" },
  { value: "month",   label: "30 días" },
  { value: "quarter", label: "90 días" },
  { value: "year",    label: "Año" },
  { value: "custom",  label: "Personalizado" },
];

export const ESTADO_COLOR: Record<string, string> = {
  PAGADO:     "var(--green)",
  PENDIENTE:  "var(--accent)",
  CONFIRMADO: "var(--blue)",
  ENTREGADO:  "var(--green)",
  CANCELADO:  "var(--red)",
};
