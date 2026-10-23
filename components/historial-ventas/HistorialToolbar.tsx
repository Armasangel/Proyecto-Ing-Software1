import { HISTORIAL_VENTAS_CLS } from "@/lib/constants/historial-ventas";
import type { HistorialVentasController } from "@/hooks/useHistorialVentas";

export function HistorialToolbar({ h }: { h: HistorialVentasController }) {
  return (
    <div className={HISTORIAL_VENTAS_CLS.toolbar}>
      <input
        type="search"
        placeholder="Buscar por cliente, producto, proveedor, # venta…"
        value={h.busqueda}
        onChange={(e) => h.setBusqueda(e.target.value)}
        className={HISTORIAL_VENTAS_CLS.searchInput}
      />
      <button
        type="button"
        onClick={() => h.setPanelFiltros((x) => !x)}
        className={`${HISTORIAL_VENTAS_CLS.btnOutlineBase} ${
          h.panelFiltros ? "border-success-strong text-success-strong" : "border-line text-ink-muted"
        }`}
      >
        {h.panelFiltros ? "Ocultar filtros" : "Filtros"}
      </button>
    </div>
  );
}
