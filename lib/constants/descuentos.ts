import type { Descuento, FormStateDescuento } from "@/lib/types/descuentos";

export const TIPOS_DESCUENTO: { valor: Descuento["tipo"]; etiqueta: string; ayuda: string }[] = [
  { valor: "PORCENTAJE", etiqueta: "Porcentaje", ayuda: "Un porcentaje fijo que aplica desde la primera unidad." },
  { valor: "CANTIDAD", etiqueta: "Por cantidad", ayuda: "Un porcentaje que aplica a partir de cierta cantidad de unidades." },
  { valor: "ESCALA", etiqueta: "Por escala", ayuda: "Varios tramos: a mayor cantidad, mayor porcentaje." },
];

export const INPUT_CLS_DESCUENTO =
  "w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";
export const INPUT_CLS_DESCUENTO_SM =
  "px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";
export const BTN_PRIMARY_DESCUENTO =
  "px-4 py-2 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110";
export const BTN_GHOST_DESCUENTO =
  "px-4 py-2 rounded-control bg-cream-100 border border-[var(--border)] text-ink-muted text-sm hover:bg-[var(--border)]/40";
export const BTN_MINI_DESCUENTO =
  "px-3 py-1.5 rounded-control border-none text-[0.82rem] font-medium transition-transform active:scale-[0.97] hover:brightness-110";

export const FORM_VACIO_DESCUENTO: FormStateDescuento = {
  nombre: "",
  tipo: "PORCENTAJE",
  tramos: [{ cantidad_desde: 0, porcentaje: "" }],
};
