"use client";

import { StaffShell } from "@/components/StaffShell";
import { useCuentasPorCobrar } from "@/hooks/useCuentasPorCobrar";
import { TabsCuentas } from "@/components/cuentas-por-cobrar/TabsCuentas";
import { DeudasTab } from "@/components/cuentas-por-cobrar/DeudasTab";

export default function CuentasPorCobrarPage() {
  const h = useCuentasPorCobrar();

  if (!h.usuario) {
    return <p className="p-8 text-ink-muted font-body">Cargando…</p>;
  }

  return (
    <StaffShell
      usuario={h.usuario}
      title="Cuentas por cobrar"
      subtitle="Control de deudas, límites y recordatorios"
    >
      <TabsCuentas h={h} />

      {h.alertaBloqueo && (
        <div className="mb-3 px-4 py-2 rounded-[12px] bg-danger/10 border border-danger text-danger text-[0.9rem]">
          {h.alertaBloqueo}
        </div>
      )}
      {h.error && <div className="mb-3 text-danger text-[0.9rem]">{h.error}</div>}
      {h.mensaje && <div className="mb-3 text-success text-[0.9rem]">{h.mensaje}</div>}

      {h.tab === "deudas" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => h.setVista(h.vista === "acumulado" ? "vencimiento" : "acumulado")}
              className="px-3 py-1 rounded-[10px] border border-line text-[0.85rem]"
            >
              {h.vista === "acumulado" ? "Ver por vencimiento" : "Ver acumulado por cliente"}
            </button>
          </div>
          <DeudasTab h={h} />
        </div>
      )}

      {h.tab === "limites" && (
        <div className="text-ink-muted text-[0.9rem]">Sección en proceso de modularización.</div>
      )}
      {h.tab === "notificaciones" && (
        <div className="text-ink-muted text-[0.9rem]">Sección en proceso de modularización.</div>
      )}
    </StaffShell>
  );
}
