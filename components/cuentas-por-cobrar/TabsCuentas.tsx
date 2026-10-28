"use client";

import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";

const TABS = [
  { id: "deudas", label: "Cuentas por cobrar" },
  { id: "limites", label: "Límites de crédito" },
  { id: "notificaciones", label: "Notificaciones" },
] as const;

export function TabsCuentas({ h }: { h: CuentasPorCobrarController }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            h.setTab(t.id);
            h.setError("");
            h.setMensaje("");
          }}
          className={`shrink-0 whitespace-nowrap px-[1.1rem] py-[0.6rem] border-none bg-transparent cursor-pointer font-semibold border-b-2 ${
            h.tab === t.id ? "text-ink border-success" : "text-ink-muted border-transparent"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
