import { PERIODOS, HISTORIAL_VENTAS_CLS } from "@/lib/constants/historial-ventas";
import type { HistorialVentasController } from "@/hooks/useHistorialVentas";

export function HistorialFiltros({ h }: { h: HistorialVentasController }) {
  if (!h.panelFiltros) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={() => h.setPanelFiltros(false)}
        className="fixed top-0 left-0 w-screen h-screen bg-black/50 border-none z-[99] cursor-pointer"
      />
      <aside className="fixed top-0 right-0 flex h-screen w-[320px] max-w-full flex-col overflow-y-auto border-l border-line bg-surface font-body text-ink shadow-[-4px_0_12px_rgba(0,0,0,0.3)] z-[100]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h2 className="m-0 font-head text-[1.05rem] font-bold">Filtros</h2>
          <button type="button" onClick={() => h.setPanelFiltros(false)} className={HISTORIAL_VENTAS_CLS.closeBtn}>
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex flex-col gap-[0.65rem]">
          <label className={HISTORIAL_VENTAS_CLS.label}>Periodo</label>
          <div className={HISTORIAL_VENTAS_CLS.btnRow}>
            {PERIODOS.map((p) => {
              const fechaActiva = Boolean(h.fechaDesde || h.fechaHasta);
              const disabled = fechaActiva && p.value !== "";
              const activo = h.periodo === p.value;
              return (
                <button
                  key={p.value || "all"}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    h.setFechaDesde("");
                    h.setFechaHasta("");
                    h.setPeriodo(p.value);
                  }}
                  className={`${HISTORIAL_VENTAS_CLS.chipBase} ${
                    activo
                      ? "bg-[var(--success-soft)] border-success-strong text-success-light"
                      : "bg-surface-soft border-line text-ink"
                  } ${disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <label className={HISTORIAL_VENTAS_CLS.label}>Rango de fechas</label>
          <div className={`flex gap-2 items-end ${h.periodo ? "opacity-45" : ""}`}>
            <div className="flex-1 flex flex-col gap-[0.3rem]">
              <label htmlFor="fecha-desde" className={HISTORIAL_VENTAS_CLS.dateLabel}>Desde</label>
              <input
                id="fecha-desde"
                type="date"
                value={h.fechaDesde}
                disabled={Boolean(h.periodo)}
                max={h.fechaHasta || undefined}
                onChange={(e) => {
                  h.setPeriodo("");
                  h.setFechaDesde(e.target.value);
                }}
                className={HISTORIAL_VENTAS_CLS.dateInput}
              />
            </div>
            <div className="flex-1 flex flex-col gap-[0.3rem]">
              <label htmlFor="fecha-hasta" className={HISTORIAL_VENTAS_CLS.dateLabel}>Hasta</label>
              <input
                id="fecha-hasta"
                type="date"
                value={h.fechaHasta}
                disabled={Boolean(h.periodo)}
                min={h.fechaDesde || undefined}
                onChange={(e) => {
                  h.setPeriodo("");
                  h.setFechaHasta(e.target.value);
                }}
                className={HISTORIAL_VENTAS_CLS.dateInput}
              />
            </div>
          </div>
          {(h.fechaDesde || h.fechaHasta) && (
            <button
              type="button"
              onClick={() => {
                h.setFechaDesde("");
                h.setFechaHasta("");
              }}
              className={HISTORIAL_VENTAS_CLS.linkBtn}
            >
              Quitar filtro de fechas
            </button>
          )}

          <label className={HISTORIAL_VENTAS_CLS.label}>Total venta (Q)</label>
          {!h.rangosMontosListos ? (
            <p className="text-ink-muted text-[0.85rem] m-0">Cargando rango de totales…</p>
          ) : (
            <>
              <div className={HISTORIAL_VENTAS_CLS.rangeRow}>
                <span className={HISTORIAL_VENTAS_CLS.rangeVal}>Min: Q{(h.minTotal ?? 0).toFixed(2)}</span>
                <span className={HISTORIAL_VENTAS_CLS.rangeVal}>Max: Q{(h.maxTotal ?? h.sliderMaxBound).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={h.sliderMinBound}
                max={h.sliderMaxBound}
                step={1}
                value={Math.min(Math.max(h.minTotal ?? 0, h.sliderMinBound), h.sliderMaxBound)}
                onChange={(e) => h.onMinSlider(Number(e.target.value))}
                className="w-full accent-success-strong"
              />
              <input
                type="range"
                min={h.sliderMinBound}
                max={h.sliderMaxBound}
                step={1}
                value={Math.min(Math.max(h.maxTotal ?? h.sliderMaxBound, h.sliderMinBound), h.sliderMaxBound)}
                onChange={(e) => h.onMaxSlider(Number(e.target.value))}
                className="w-full accent-success-strong mt-2"
              />
            </>
          )}

          <label className={HISTORIAL_VENTAS_CLS.label}>Producto</label>
          <button type="button" onClick={() => { h.setPicker("producto"); h.setPickerBusqueda(""); }} className={HISTORIAL_VENTAS_CLS.btnPicker}>
            {h.idProducto == null
              ? "Todos los productos"
              : `${h.nombreProductoSel?.codigo_producto ?? h.idProducto} — ${h.nombreProductoSel?.nombre_producto ?? ""}`}
          </button>
          {h.idProducto != null && (
            <button type="button" onClick={() => h.setIdProducto(null)} className={HISTORIAL_VENTAS_CLS.linkBtn}>
              Quitar filtro
            </button>
          )}

          <label className={HISTORIAL_VENTAS_CLS.label}>Cliente</label>
          <button type="button" onClick={() => { h.setPicker("cliente"); h.setPickerBusqueda(""); }} className={HISTORIAL_VENTAS_CLS.btnPicker}>
            {h.idCliente == null ? "Todos los clientes" : `${h.nombreClienteSel?.nombre ?? h.idCliente}`}
          </button>
          {h.idCliente != null && (
            <button type="button" onClick={() => h.setIdCliente(null)} className={HISTORIAL_VENTAS_CLS.linkBtn}>
              Quitar filtro
            </button>
          )}

          <label className={HISTORIAL_VENTAS_CLS.label}>Proveedor</label>
          <button type="button" onClick={() => { h.setPicker("proveedor"); h.setPickerBusqueda(""); }} className={HISTORIAL_VENTAS_CLS.btnPicker}>
            {h.idProveedor == null ? "Todos los proveedores" : h.nombreProveedorSel?.nombre_proveedor ?? h.idProveedor}
          </button>
          {h.idProveedor != null && (
            <button type="button" onClick={() => h.setIdProveedor(null)} className={HISTORIAL_VENTAS_CLS.linkBtn}>
              Quitar filtro
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
