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

export const CAT_COLORS = [
  "rgba(45,106,79,.85)",
  "rgba(88,166,255,.85)",
  "rgba(232,160,69,.85)",
  "rgba(248,81,73,.85)",
  "rgba(63,185,80,.85)",
  "rgba(180,83,189,.85)",
  "rgba(255,168,68,.85)",
];
