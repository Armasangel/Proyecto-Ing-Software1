export const PERIODOS: { value: string; label: string }[] = [
  { value: "", label: "Todo" },
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

export const HISTORIAL_VENTAS_CLS = {
  toolbar: "flex gap-3 flex-wrap items-center mb-5",
  searchInput:
    "flex-1 min-w-[200px] bg-surface-soft border border-line rounded-[10px] px-4 py-[0.65rem] text-ink text-[0.9rem] outline-none",
  btnOutlineBase:
    "bg-transparent border rounded-[10px] px-4 py-[0.65rem] cursor-pointer text-[0.88rem] font-semibold font-body",
  btnPrimary:
    "bg-success-strong text-white border-none rounded-[10px] px-[1.1rem] py-[0.55rem] font-semibold cursor-pointer text-[0.88rem]",
  tableWrapper: "bg-surface border border-line rounded-control overflow-auto",
  table: "w-full border-collapse",
  th: "bg-surface-soft text-ink-muted text-[0.72rem] font-semibold tracking-[0.06em] uppercase px-4 py-3 text-left border-b border-line",
  td: "px-4 py-3 text-[0.88rem] align-top",
  code: "bg-surface-soft border border-line rounded px-[0.4rem] py-[0.12rem] text-[0.78rem] text-success-strong font-mono",
  badgeEstado:
    "inline-block text-[0.72rem] px-[0.55rem] py-[0.15rem] rounded-full border font-semibold",
  tag: "text-[0.65rem] px-[0.35rem] py-[0.08rem] rounded-md bg-surface-soft text-ink-muted border border-line",
  closeBtn: "bg-transparent border-none text-ink-muted text-[1.1rem] cursor-pointer",
  label:
    "text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-muted mt-2",
  btnRow: "flex flex-wrap gap-[0.4rem]",
  chipBase: "border rounded-lg px-[0.65rem] py-[0.4rem] text-[0.78rem] font-semibold",
  rangeRow: "flex justify-between text-[0.78rem] text-ink-muted",
  rangeVal: "tabular-nums",
  dateLabel: "text-[0.72rem] text-ink-muted",
  dateInput:
    "bg-surface-soft border border-line rounded-[10px] px-[0.7rem] py-[0.55rem] text-ink text-[0.85rem] font-body [color-scheme:dark] outline-none",
  btnPicker:
    "w-full text-left bg-surface-soft border border-line rounded-[10px] px-[0.85rem] py-[0.65rem] text-ink text-[0.88rem] cursor-pointer",
  linkBtn:
    "bg-none border-none text-info text-[0.8rem] cursor-pointer text-left p-0 -mt-1",
  listItem:
    "w-full flex flex-col items-start gap-0.5 px-5 py-[0.65rem] border-b border-line bg-transparent text-ink cursor-pointer text-left",
};
