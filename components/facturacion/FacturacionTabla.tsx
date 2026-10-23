"use client";

import { PaginationBar } from "@/lib/ui-table";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO } from "@/lib/tipos-documento";
import type { FacturacionController } from "@/hooks/useFacturacion";

export function FacturacionTabla({ f }: { f: FacturacionController }) {
  const page = (f.ventasPage as any).page ?? (f.ventasPage as any).paginaSegura ?? 1;
  const pageCount = (f.ventasPage as any).pageCount ?? (f.ventasPage as any).totalPages ?? (f.ventasPage as any).totalPaginas ?? 1;
  const items = (f.ventasPage as any).items ?? (f.ventasPage as any).slice ?? [];
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
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v: any) => (
              <tr key={v.id_venta} className="border-t border-[var(--border)] hover:bg-cream/40 transition-colors">
                <td className="px-3.5 py-2.5">
                  <code className="text-[0.85rem]">#{v.id_venta}</code>
                </td>
                <td className="px-3.5 py-2.5">
                  <div className="font-medium text-ink">{v.nombre}</div>
                  <div className="text-[0.78rem] text-ink-muted">
                    {v.codigo_cliente ? `${v.codigo_cliente} · ` : ""}
                    {v.correo}
                  </div>
                </td>
                <td className="px-3.5 py-2.5 text-ink-muted">
                  {new Date(v.fecha_venta).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-3.5 py-2.5 font-semibold">Q{Number(v.total).toFixed(2)}</td>
                <td className="px-3.5 py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[0.78rem] bg-cream border border-[var(--border)] text-ink">{v.estado_venta}</span>
                </td>
                <td className="px-3.5 py-2.5">
                  {v.numero_factura ? (
                    <span className="text-[0.85rem]">
                      {ETIQUETAS_TIPO_DOCUMENTO[v.tipo_documento as keyof typeof ETIQUETAS_TIPO_DOCUMENTO] ?? "Factura"} {v.numero_factura}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Sin emitir</span>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  {v.numero_factura ? (
                    <button type="button" onClick={() => f.verFactura(v.id_venta)} disabled={f.cargandoDetalle} className="px-2.5 py-1.5 rounded-control border border-[var(--border)] bg-white text-[0.82rem] hover:bg-cream transition-colors disabled:opacity-60">
                      {f.cargandoDetalle ? "Cargando…" : "Ver / Imprimir"}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={f.tipoDocumentoEmitir[v.id_venta] ?? "FACTURA"}
                        onChange={(e) => f.setTipoDocumentoEmitir((prev) => ({ ...prev, [v.id_venta]: e.target.value as any }))}
                        className="px-2 py-1 rounded-control border border-[var(--border)] bg-white text-[0.82rem]"
                      >
                        {TIPOS_DOCUMENTO.map((t) => (
                          <option key={t} value={t}>{ETIQUETAS_TIPO_DOCUMENTO[t]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={f.cargando}
                        onClick={() => f.emitirFactura(v.id_venta, f.tipoDocumentoEmitir[v.id_venta] ?? "FACTURA")}
                        className="px-2.5 py-1.5 rounded-control bg-market text-white text-[0.82rem] hover:brightness-110 disabled:opacity-60"
                      >
                        Emitir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <PaginationBar
          total={(f.ventasPage as any).total}
          page={page}
          perPage={f.perPage}
          onPage={f.setPage as any}
          onPerPage={f.setPerPage as any}
          noun="ventas"
        />
      </div>
    </>
  );
}
