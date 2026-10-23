"use client";

import { tabPillClass } from "@/lib/constants/cuentas-por-cobrar";
import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";

export function TabsCuentas({ h }: { h: CuentasPorCobrarController }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button type="button" className={tabPillClass(h.tab === "deudas")} onClick={() => h.setTab("deudas")}>
        Deudas
      </button>
      <button type="button" className={tabPillClass(h.tab === "limites")} onClick={() => h.setTab("limites")}>
        Límites de deuda
      </button>
      <button type="button" className={tabPillClass(h.tab === "notificaciones")} onClick={() => h.setTab("notificaciones")}>
        Notificaciones
      </button>
    </div>
  );
}
