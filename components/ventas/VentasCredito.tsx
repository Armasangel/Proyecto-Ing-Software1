import { CUOTAS_MAXIMAS, PLAZO_MAXIMO_DIAS, sumarDias } from "@/lib/credito";
import { OPCIONES_PAGOS, PLAZOS_RAPIDOS } from "@/lib/constants/ventas";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/tipos-documento";
import { inputCls, labelCls } from "@/lib/styles/forms";
import { formatoFecha, hoyLocalISO } from "@/lib/ventas-utils";
import type { VentasController } from "@/hooks/useVentas";

export function VentasCredito({ v }: { v: VentasController }) {
  if (v.condicionPago !== "CREDITO") return null;

  return (
    <div className="flex flex-col gap-3 p-4 border border-market/40 bg-market-50/50 rounded-control">
      <div className="font-semibold text-[0.9rem] text-market-600">Condiciones del crédito</div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Tipo de documento</label>
        <select
          value={v.tipoDocumentoCredito}
          onChange={(e) => v.setTipoDocumentoCredito(e.target.value as TipoDocumento)}
          className={inputCls}
          aria-label="Tipo de documento"
        >
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t} value={t}>
              {ETIQUETAS_TIPO_DOCUMENTO[t]}
            </option>
          ))}
        </select>
        <span className="text-[0.78rem] text-ink-muted">
          La factura cambiaria usa el NIT y la dirección registrados del cliente.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Fecha de la factura</label>
        <div className="flex items-center gap-3 flex-wrap">
          {v.otraFechaFactura ? (
            <input
              type="date"
              value={v.fechaFactura}
              max={hoyLocalISO()}
              min={sumarDias(hoyLocalISO(), -365)}
              onChange={(e) => v.setFechaFactura(e.target.value)}
              className={`${inputCls} max-w-[200px]`}
              aria-label="Fecha de la factura"
            />
          ) : (
            <span className="text-[0.95rem] text-ink">Hoy, {formatoFecha(hoyLocalISO())}</span>
          )}
          <label className="flex items-center gap-2 text-[0.85rem] text-ink-muted">
            <input
              type="checkbox"
              checked={v.otraFechaFactura}
              onChange={(e) => {
                v.setOtraFechaFactura(e.target.checked);
                if (!e.target.checked) v.setFechaFactura("");
              }}
            />
            Elegir otra fecha
          </label>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
          <label className={labelCls}>Plazo para pagar (días)</label>
          <input
            type="number"
            min={1}
            max={PLAZO_MAXIMO_DIAS}
            value={v.plazoDias}
            onChange={(e) => v.setPlazoDias(e.target.value)}
            className={inputCls}
            aria-label="Plazo en días"
          />
          <div className="flex gap-1.5 flex-wrap">
            {PLAZOS_RAPIDOS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => v.setPlazoDias(String(d))}
                className={`px-2.5 py-1 rounded-control border text-[0.78rem] font-semibold ${
                  Number(v.plazoDias) === d
                    ? "bg-market text-white border-market"
                    : "border-[var(--border)] text-ink-muted hover:bg-cream"
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
          <label className={labelCls}>Forma de pago del crédito</label>
          <select
            value={v.numeroCuotas}
            onChange={(e) => v.setNumeroCuotas(e.target.value)}
            className={inputCls}
            aria-label="Número de pagos"
          >
            {OPCIONES_PAGOS.filter((n) => n <= CUOTAS_MAXIMAS).map((n) => (
              <option key={n} value={n}>{n === 1 ? "Pago único" : `${n} pagos`}</option>
            ))}
          </select>
        </div>
      </div>

      {v.errorCredito ? (
        <div className="text-[0.85rem] text-achiote-600 font-medium">{v.errorCredito}</div>
      ) : v.planCuotas.length > 0 ? (
        <div className="flex flex-col gap-1" aria-label="Plan de pagos">
          <div className="text-[0.82rem] font-semibold text-ink-muted">Plan de pagos</div>
          {v.planCuotas.map((c) => (
            <div key={c.numero} className="flex justify-between text-[0.9rem] text-ink">
              <span>
                {v.planCuotas.length === 1 ? "Pago único" : `Pago ${c.numero}`} · vence {formatoFecha(c.fecha_vencimiento)}
              </span>
              <span className="font-semibold">Q{c.monto.toFixed(2)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[0.85rem] text-ink-muted">Agrega productos para ver el plan de pagos.</div>
      )}
    </div>
  );
}
