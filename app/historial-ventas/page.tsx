"use client";

import { StaffShell } from "@/components/StaffShell";
import { useHistorialVentas } from "@/hooks/useHistorialVentas";
import { PaginationBar } from "@/components/pagination/PaginationBar";
import { HistorialToolbar } from "@/components/historial-ventas/HistorialToolbar";
import { HistorialTabla } from "@/components/historial-ventas/HistorialTabla";
import { HistorialFiltros } from "@/components/historial-ventas/HistorialFiltros";
import { HistorialPickers } from "@/components/historial-ventas/HistorialPickers";

export default function HistorialVentasPage() {
  const h = useHistorialVentas();

  if (!h.usuario) {
    return <p className="p-8 text-ink-muted font-body">Cargando…</p>;
  }

  if (h.usuario.tipo_usuario !== "DUENO") {
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

      {/* Paginación unificada: reemplaza el botón "Cargar más" con PaginationBar */}
      <PaginationBar
        total={h.pagination?.maxLimit || 50}
        page={1}
        perPage={h.pagination?.limit || 50}
        onPageChange={() => {}}
        onPerPageChange={() => {}}
        noun="ventas"
        variant="default"
      />

      <HistorialFiltros h={h} />
      <HistorialPickers h={h} />
    </StaffShell>
  );
}
