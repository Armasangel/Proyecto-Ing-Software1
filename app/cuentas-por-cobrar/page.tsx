"use client";

import { StaffShell } from "@/components/StaffShell";
import { useCuentasPorCobrar } from "@/hooks/useCuentasPorCobrar";
import { TabsCuentas } from "@/components/cuentas-por-cobrar/TabsCuentas";
import { DeudasTab } from "@/components/cuentas-por-cobrar/DeudasTab";
import { LimitesTab } from "@/components/cuentas-por-cobrar/LimitesTab";
import { NotificacionesTab } from "@/components/cuentas-por-cobrar/NotificacionesTab";

export default function CuentasPorCobrarPage() {
  const h = useCuentasPorCobrar();

  if (!h.usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  if (h.usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={h.usuario} title="Cuentas por cobrar" subtitle="">
        <p className="text-ink-muted">No tienes permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  return (
    <StaffShell
      usuario={h.usuario}
      title="Cuentas por cobrar"
      subtitle="Registra y controla las cuentas por cobrar pendientes"
    >
      {h.mensaje && <p className="text-success mb-4 font-semibold">{h.mensaje}</p>}
      {h.error && <p className="text-danger mb-4 font-semibold">{h.error}</p>}
      {h.alertaBloqueo && (
        <p
          className={`text-white px-4 py-[0.6rem] rounded-[14px] mb-4 font-semibold ${
            h.alertaBloqueo.startsWith("⚠️") ? "bg-danger" : "bg-success"
          }`}
        >
          {h.alertaBloqueo}
        </p>
      )}

      <TabsCuentas h={h} />

      {h.tab === "deudas" && <DeudasTab h={h} />}
      {h.tab === "limites" && <LimitesTab h={h} />}
      {h.tab === "notificaciones" && <NotificacionesTab h={h} />}
    </StaffShell>
  );
}
