"use client";

import { StaffShell } from "@/components/StaffShell";
import { TIPOS_USUARIO } from "@/lib/roles";
import { useHistorialVentas } from "@/hooks/useHistorialVentas";
import { HISTORIAL_VENTAS_CLS } from "@/lib/constants/historial-ventas";
import { HistorialToolbar } from "@/components/historial-ventas/HistorialToolbar";
import { HistorialTabla } from "@/components/historial-ventas/HistorialTabla";
import { HistorialFiltros } from "@/components/historial-ventas/HistorialFiltros";
import { HistorialPickers } from "@/components/historial-ventas/HistorialPickers";

export default function HistorialVentasPage() {
  const h = useHistorialVentas();

  if (!h.usuario) {
    return <p className="p-8 text-ink-muted font-body">Cargando…</p>;
  }

  if (h.usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
    return null;
  }

  return (
    <StaffShell
      usuario={h.usuario}
      title="Historial de ventas"
      subtitle="Consulta y filtra todas las ventas registradas"
    >
      <HistorialToolbar h={h} />

      {h.error && <p className="text-achiote mb-3 text-[0.9rem]">{h.error}</p>}

      <HistorialTabla h={h} />

      <div className="mt-4 flex gap-3 items-center">
        {h.pagination?.hasMore && (
          <button
            type="button"
            disabled={h.cargando || h.pagination.nextOffset == null}
            onClick={() => h.pagination?.nextOffset != null && h.setOffset(h.pagination.nextOffset)}
            className={HISTORIAL_VENTAS_CLS.btnPrimary}
          >
            Cargar más
          </button>
        )}
        {h.cargando && h.ventas.length > 0 && (
          <span className="text-ink-muted text-[0.85rem]">Actualizando…</span>
        )}
      </div>

      <HistorialFiltros h={h} />
      <HistorialPickers h={h} />
    </StaffShell>
  );
}
