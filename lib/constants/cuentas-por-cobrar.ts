export const COLOR_CUOTA: Record<string, string> = {
  PAGADA: "#52b788",
  PARCIAL: "#f4a261",
  PENDIENTE: "var(--muted)",
  VENCIDA: "#e63946",
};

export const TEXTO_CUOTA: Record<string, string> = {
  PAGADA: "Pagada",
  PARCIAL: "Pago parcial",
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
};

export const CLS_CPC = {
  input: "px-[0.6rem] py-[0.3rem] rounded-[14px] border border-line bg-surface text-ink",
  td: "p-3",
  tdSm: "p-[0.4rem]",
  badgeBloqueado: "ml-1.5 text-[0.72rem] text-white bg-danger px-1.5 py-px rounded-lg",
};

export const tabPillClass = (activo: boolean): string =>
  `px-[0.9rem] py-[0.35rem] rounded-full cursor-pointer text-[0.82rem] font-semibold border ${
    activo ? "border-success bg-success text-white" : "border-line bg-transparent text-ink"
  }`;

export const formVacioCPC = {
  id_cliente: "",
  monto: "",
  fecha_limite_pago: "",
};
