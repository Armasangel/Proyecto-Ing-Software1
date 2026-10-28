import { Icon } from "@/components/Icon";
import { CantidadInput } from "@/components/CantidadInput";
import { ProductoAutocompletar } from "@/components/ProductoAutocompletar";
import { inputCls, labelCls } from "@/lib/styles/forms";
import type { VentasController } from "@/hooks/useVentas";

export function VentasLineas({ v }: { v: VentasController }) {
  return (
    <div className="mt-2">
      <div className="font-semibold text-[0.9rem] mb-3 text-ink">Productos</div>
      <div className="flex flex-col gap-4">
        {v.lineas.map((ln) => {
          const pSel = ln.id_producto ? v.productoPorId.get(Number(ln.id_producto)) : undefined;
          const disponible = v.stockDisponible(ln.id_producto, ln.id_bodega);
          const presentaciones = v.presentacionesPorProducto[Number(ln.id_producto)] || [];
          return (
            <div key={ln.key} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label className={labelCls}>Producto</label>
                  <ProductoAutocompletar
                    productos={v.productosActivos}
                    value={ln.id_producto}
                    onChange={(id) => v.onProductoChange(ln.key, id)}
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => v.quitarLinea(ln.key)}
                  disabled={v.lineas.length <= 1}
                  title="Quitar línea"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-[var(--border)] bg-cream/60 text-ink-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-achiote-50 enabled:hover:text-achiote-600"
                >
                  <Icon name="close" variant="dark" size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Bodega *</label>
                  <select
                    value={ln.id_bodega}
                    onChange={(e) => v.actualizarLinea(ln.key, { id_bodega: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">— Bodega —</option>
                    {v.bodegas.map((b) => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Cantidad</label>
                  <CantidadInput
                    ariaLabel="Cantidad"
                    className={inputCls}
                    value={ln.cantidad}
                    onChange={(cantidad) => v.actualizarLinea(ln.key, { cantidad })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Presentación</label>
                  <select
                    value={ln.id_presentacion}
                    onChange={(e) => v.actualizarLinea(ln.key, { id_presentacion: e.target.value })}
                    className={inputCls}
                    disabled={presentaciones.length === 0}
                    aria-label="Presentación"
                  >
                    <option value="">Unidad</option>
                    {presentaciones.map((pr) => (
                      <option key={pr.id_presentacion} value={pr.id_presentacion}>
                        {pr.nombre_presentacion} (×{Number(pr.factor_conversion)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>P. venta</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ln.precio_unitario_venta}
                    onChange={(e) => v.actualizarLinea(ln.key, { precio_unitario_venta: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {(() => {
                const d = v.descuentoDeLinea(ln);
                if (!pSel && !(ln.id_presentacion && Number(ln.cantidad) > 0) && d.monto <= 0) return null;
                return (
                  <span className="text-[0.78rem] text-ink-muted">
                    {pSel && <>Unidad: {pSel.unidad_medida}</>}
                    {ln.id_bodega && (
                      <> · Disponible en bodega: <strong className={disponible > 0 ? "text-market-600" : "text-achiote-600"}>{disponible}</strong></>
                    )}
                    {ln.id_presentacion && Number(ln.cantidad) > 0 && (
                      <> · = {(Number(ln.cantidad) * v.factorDeLinea(ln)).toLocaleString("es-GT")} unidades</>
                    )}
                    {d.monto > 0 && (
                      <>
                        {" "}· Descuento {d.porcentaje}%: <strong className="text-market-600">−Q{d.monto.toFixed(2)}</strong>
                        {" "}· Subtotal: <strong className="text-ink">Q{d.neto.toFixed(2)}</strong>
                      </>
                    )}
                  </span>
                );
              })()}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={v.agregarLinea}
        className="mt-3 px-3.5 py-2 rounded-control border border-market bg-transparent text-market-600 font-semibold text-[0.88rem] transition-transform active:scale-[0.97] hover:bg-market-50"
      >
        + Agregar producto
      </button>
    </div>
  );
}
