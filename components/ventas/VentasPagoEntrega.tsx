import { inputCls, labelCls } from "@/lib/styles/forms";
import type { VentasController } from "@/hooks/useVentas";

export function VentasPagoEntrega({ v }: { v: VentasController }) {
  return (
    <>
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
          <label className={labelCls}>Forma de pago *</label>
          <div className="flex gap-2" role="group" aria-label="Forma de pago">
            {([
              { v: "CONTADO", t: "Contado" },
              { v: "CREDITO", t: "Crédito" },
            ] as const).map((o) => {
              const creditoBloqueado = o.v === "CREDITO" && !!v.clienteSeleccionado?.es_consumidor_final;
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={v.condicionPago === o.v}
                  disabled={creditoBloqueado}
                  title={creditoBloqueado ? "Consumidor Final solo puede vender a Contado" : undefined}
                  onClick={() => v.setCondicionPago(o.v)}
                  className={`flex-1 px-3 py-2.5 rounded-control border text-[0.95rem] font-semibold transition-colors ${
                    v.condicionPago === o.v
                      ? "bg-market text-white border-market"
                      : "bg-transparent text-ink-muted border-[var(--border)] hover:bg-cream"
                  } ${creditoBloqueado ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
                >
                  {o.t}
                </button>
              );
            })}
          </div>
          <span className="text-[0.78rem] text-ink-muted">
            {v.clienteSeleccionado?.es_consumidor_final
              ? "Consumidor Final solo puede vender a Contado."
              : v.condicionPago === "CONTADO"
              ? "El cliente paga el total en este momento."
              : "Se genera la factura y una cuenta por cobrar."}
          </span>
        </div>

        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
          <label className={labelCls}>Tipo de venta</label>
          {v.forzarTipoVenta ? (
            <select
              value={v.tipoVenta}
              onChange={(e) => {
                const valor = e.target.value;
                v.setTipoVenta(valor);
                v.aplicarPreciosPorTipo(valor);
              }}
              className={inputCls}
            >
              <option value="MINORISTA">Minorista</option>
              <option value="MAYORISTA">Mayorista</option>
            </select>
          ) : (
            <div className={`${inputCls} flex items-center justify-between bg-cream/30 cursor-default`}>
              <span>{v.tipoVenta === "MAYORISTA" ? "Mayorista" : "Minorista"}</span>
              <span className="text-[0.72rem] text-ink-muted">
                {v.idCliente ? "detectado del cliente" : "por defecto"}
              </span>
            </div>
          )}
          <label className="flex items-center gap-2 text-[0.78rem] text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={v.forzarTipoVenta}
              onChange={(e) => v.onForzarTipoVentaChange(e.target.checked)}
            />
            Forzar un tipo distinto al del cliente
          </label>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
          <label className={labelCls}>Tipo de entrega *</label>
          <select
            value={v.tipoEntrega}
            onChange={(e) => {
              const valor = e.target.value;
              v.setTipoEntrega(valor);
              if (valor === "DOMICILIO" && !v.direccionEntrega.trim() && v.clienteSeleccionado?.direccion) {
                v.setDireccionEntrega(v.clienteSeleccionado.direccion);
              }
            }}
            className={inputCls}
          >
            <option value="EN_TIENDA">En tienda</option>
            <option value="DOMICILIO">Domicilio</option>
          </select>
        </div>
      </div>

      {v.tipoEntrega === "DOMICILIO" && (
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Dirección de entrega *</label>
          <input
            value={v.direccionEntrega}
            onChange={(e) => v.setDireccionEntrega(e.target.value)}
            placeholder="Zona, calle, referencias…"
            className={inputCls}
          />
        </div>
      )}
    </>
  );
}
