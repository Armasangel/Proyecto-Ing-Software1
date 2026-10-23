import { HISTORIAL_VENTAS_CLS } from "@/lib/constants/historial-ventas";
import type { HistorialVentasController } from "@/hooks/useHistorialVentas";

export function HistorialPickers({ h }: { h: HistorialVentasController }) {
  if (!h.picker) return null;

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black/50 backdrop-blur-[4px] flex items-center justify-center z-[101] p-4"
      role="presentation"
      onClick={() => h.setPicker(null)}
    >
      <div
        className="bg-surface text-ink border border-line rounded-[12px] w-[90%] max-w-[480px] max-h-[80vh] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
          <h3 className="m-0 font-head text-base font-bold text-ink">
            {h.picker === "producto" && "Elegir producto"}
            {h.picker === "cliente" && "Elegir cliente"}
            {h.picker === "proveedor" && "Elegir proveedor"}
          </h3>
          <button
            type="button"
            className="bg-transparent border-none text-ink text-[1.1rem] cursor-pointer"
            onClick={() => h.setPicker(null)}
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-4">
          <input
            type="search"
            placeholder="Filtrar lista…"
            value={h.pickerBusqueda}
            onChange={(e) => h.setPickerBusqueda(e.target.value)}
            className={HISTORIAL_VENTAS_CLS.searchInput}
          />
        </div>
        <div className="overflow-y-auto max-h-[50vh] px-5 pb-5 pt-0">
          {h.picker === "producto" &&
            h.productosPickerFiltrados.map((p) => (
              <button
                key={p.id_producto}
                type="button"
                className={HISTORIAL_VENTAS_CLS.listItem}
                onClick={() => {
                  h.setIdProducto(p.id_producto);
                  h.setPicker(null);
                }}
              >
                <span className="font-semibold block">{p.codigo_producto}</span>
                <span className="text-ink-muted text-[0.85rem]">{p.nombre_producto}</span>
              </button>
            ))}
          {h.picker === "cliente" &&
            h.clientesPickerFiltrados.map((c: any) => (
              <button
                key={c.id_cliente}
                type="button"
                className={HISTORIAL_VENTAS_CLS.listItem}
                onClick={() => {
                  h.setIdCliente(c.id_cliente);
                  h.setPicker(null);
                }}
              >
                <span className="font-semibold block">{c.nombre}</span>
                <span className="text-ink-muted text-[0.85rem]">
                  {c.codigo_cliente ? `${c.codigo_cliente} · ` : ""}
                  {c.correo}
                </span>
              </button>
            ))}
          {h.picker === "proveedor" &&
            h.proveedoresPickerFiltrados.map((p) => (
              <button
                key={p.id_proveedor}
                type="button"
                className={HISTORIAL_VENTAS_CLS.listItem}
                onClick={() => {
                  h.setIdProveedor(p.id_proveedor);
                  h.setPicker(null);
                }}
              >
                <span className="font-semibold block">{p.nombre_proveedor}</span>
                <span className="text-ink-muted text-[0.85rem]">NIT {p.nit_proveedor}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
