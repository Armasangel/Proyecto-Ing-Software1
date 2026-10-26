"use client";

import { PaginationBar } from "@/lib/ui-table";
import {
  ETIQUETAS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO,
  etiquetaTipoDocumento,
  type TipoDocumento,
} from "@/lib/tipos-documento";
import { inputClsTablaFacturacion } from "@/lib/constants/facturacion";
import type { FacturacionController } from "@/hooks/useFacturacion";

export function FacturacionTabla({ f }: { f: FacturacionController }) {
  const { slice, total, paginaSegura } = f.ventasPage;

  return (
    <>
      <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
        <table className="w-full border-collapse text-[0.9rem]">
          <thead>
            <tr className="bg-market">
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">#Venta</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Cliente</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Fecha</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Total</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Documento</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white"># Factura</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Acción</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3.5 py-8 text-center text-ink-muted">
                  {f.q.trim() || f.filtroEstado || f.filtroFactura !== "todas"
                    ? "Ningún resultado para esa búsqueda o filtro."
                    : "No hay ventas registradas."}
                </td>
              </tr>
            ) : (
              slice.map((v, i) => {
                const tipoElegido = f.tipoDocumentoEmitir[v.id_venta] ?? "FACTURA";
                return (
                  <tr key={v.id_venta} className={i % 2 === 0 ? "bg-cream/40" : "bg-white"}>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">
                      {v.id_venta}
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink">
                      {v.codigo_cliente ? (
                        <span className="text-ink-muted mr-1.5">{v.codigo_cliente}</span>
                      ) : null}
                      {v.nombre}
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">
                      {new Date(v.fecha_venta).toLocaleDateString("es-GT")}
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink">
                      Q{Number(v.total).toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)]">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          v.estado_venta === "CONFIRMADO"
                            ? "bg-market-50 text-market-600"
                            : "bg-mango-50 text-mango-600"
                        }`}
                      >
                        {v.estado_venta}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">
                      {v.tipo_documento ? etiquetaTipoDocumento(v.tipo_documento) : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">
                      {v.numero_factura || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-[var(--border)]">
                      {!v.id_factura ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={tipoElegido}
                            onChange={(e) =>
                              f.setTipoDocumentoEmitir((prev) => ({
                                ...prev,
                                [v.id_venta]: e.target.value as TipoDocumento,
                              }))
                            }
                            aria-label={`Tipo de documento de la venta ${v.id_venta}`}
                            className={`${inputClsTablaFacturacion} py-1.5 text-[0.85rem]`}
                          >
                            {TIPOS_DOCUMENTO.map((t) => (
                              <option key={t} value={t}>
                                {ETIQUETAS_TIPO_DOCUMENTO[t]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => f.emitirFactura(v.id_venta, tipoElegido)}
                            disabled={f.cargando}
                            className="px-3 py-1.5 rounded-control bg-market text-white border-none text-[0.85rem] font-medium transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-60"
                          >
                            Emitir
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => f.verFactura(v.id_venta)}
                          disabled={f.cargandoDetalle}
                          className="px-3 py-1.5 rounded-control bg-white text-market border border-market text-[0.85rem] font-medium transition-transform active:scale-[0.97] hover:bg-market/10 disabled:opacity-60"
                        >
                          Ver factura
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <PaginationBar
          total={total}
          page={paginaSegura}
          perPage={f.perPage}
          onPage={f.setPage}
          onPerPage={f.setPerPage}
          noun="ventas"
        />
      </div>
    </>
  );
}
