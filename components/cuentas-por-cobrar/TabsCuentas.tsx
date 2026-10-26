"use client";

import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";

const TABS = [
  { id: "deudas", label: "Cuentas por cobrar" },
  { id: "limites", label: "Límites de crédito" },
  { id: "notificaciones", label: "Notificaciones" },
] as const;

export function TabsCuentas({ h }: { h: CuentasPorCobrarController }) {
  return (
    <div className="flex gap-1 mb-6 border-b border-line">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            h.setTab(t.id);
            h.setError("");
            h.setMensaje("");
          }}
          className={`px-[1.1rem] py-[0.6rem] border-none bg-transparent cursor-pointer font-semibold border-b-2 ${
            h.tab === t.id ? "text-ink border-success" : "text-ink-muted border-transparent"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
