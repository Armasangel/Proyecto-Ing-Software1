"use client";

import { PaginationBar } from "@/lib/ui-table";
import type { useProveedores } from "@/hooks/useProveedores";

export function ProveedoresTabla({ h }: { h: ReturnType<typeof useProveedores> }) {
  const { proveedoresPage } = h;

  return (
    <>
      <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
        <table className="w-full border-collapse min-w-[880px]">
          <thead>
            <tr className="bg-market">
              <th className="px-4 py-2.5 text-left text-[0.82rem] font-semibold text-white">Nombre</th>
              <th className="px-4 py-2.5 text-left text-[0.82rem] font-semibold text-white">NIT</th>
              <th className="px-4 py-2.5 text-left text-[0.82rem] font-semibold text-white">Correo</th>
              <th className="px-4 py-2.5 text-left text-[0.82rem] font-semibold text-white">Teléfono</th>
              <th className="px-4 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado</th>
              <th className="px-4 py-2.5 text-right text-[0.82rem] font-semibold text-white">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedoresPage.slice.map((p, i) => (
              <tr key={p.id_proveedor} className={i % 2 === 0 ? "bg-cream/40" : "bg-white"}>
                <td className="px-4 py-2.5 text-[0.9rem] text-ink border-b border-[var(--border)]">{p.nombre_proveedor}</td>
                <td className="px-4 py-2.5 text-[0.9rem] text-ink border-b border-[var(--border)]">{p.nit_proveedor}</td>
                <td className="px-4 py-2.5 text-[0.9rem] text-ink border-b border-[var(--border)]">{p.correo_contacto || "—"}</td>
                <td className="px-4 py-2.5 text-[0.9rem] text-ink border-b border-[var(--border)]">{p.telefono || "—"}</td>
                <td className="px-4 py-2.5 text-[0.88rem] border-b border-[var(--border)]">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      p.estado_proveedor ? "bg-market/15 text-market-600" : "bg-achiote/15 text-achiote-600"
                    }`}
                  >
                    {p.estado_proveedor ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right border-b border-[var(--border)]">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => h.iniciarEdicion(p)}
                      className="px-3 py-1.5 rounded-control border border-[var(--border)] text-[0.85rem] text-ink hover:bg-cream-100"
                    >
                      Editar
                    </button>
                    {p.estado_proveedor ? (
                      <button
                        onClick={() => h.desactivar(p.id_proveedor)}
                        className="px-3 py-1.5 rounded-control border border-achiote/40 text-[0.85rem] text-achiote hover:bg-achiote/10"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => h.reactivar(p)}
                        disabled={h.reactivando !== null}
                        className="px-3 py-1.5 rounded-control border border-market/40 text-[0.85rem] text-market-600 hover:bg-market/10 disabled:opacity-50"
                      >
                        {h.reactivando === p.id_proveedor ? "Reactivando…" : "Reactivar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {proveedoresPage.slice.length === 0 && (
          <div className="p-6 text-center text-ink-muted">
            {h.q.trim() || h.filtroEstado ? "Ningún resultado para esa búsqueda o filtro." : "No hay proveedores registrados."}
          </div>
        )}
      </div>
      <div className="mt-4">
        <PaginationBar
          page={proveedoresPage.paginaSegura}
          perPage={h.perPage}
          total={proveedoresPage.total}
          onPage={h.setPage}
          onPerPage={h.setPerPage}
          noun="proveedores"
        />
      </div>
    </>
  );
}
