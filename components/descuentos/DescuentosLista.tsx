"use client";

import type { useDescuentos } from "@/hooks/useDescuentos";

export function DescuentosLista({ h }: { h: ReturnType<typeof useDescuentos> }) {
  return (
    <div className="flex flex-col gap-4">
      {h.descuentos.length === 0 && <p className="text-ink-muted">No hay descuentos configurados.</p>}
      {h.descuentos.map((d) => (
        <div key={d.id_descuento} className="bg-white border border-[var(--border)] rounded-card shadow-warm p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-ink">{d.nombre}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    d.activo ? "bg-market/15 text-market-600" : "bg-achiote/15 text-achiote-600"
                  }`}
                >
                  {d.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p className="text-sm text-ink-muted mt-1">
                Tipo: {d.tipo === "PORCENTAJE" ? "Porcentaje" : d.tipo === "CANTIDAD" ? "Por cantidad" : "Por escala"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => h.iniciarEdicion(d)} className="px-3 py-1.5 rounded-control border border-[var(--border)] text-[0.85rem] text-ink hover:bg-cream-100">
                Editar
              </button>
              <button onClick={() => h.toggleActivo(d)} className="px-3 py-1.5 rounded-control border border-[var(--border)] text-[0.85rem] text-ink hover:bg-cream-100">
                {d.activo ? "Desactivar" : "Activar"}
              </button>
              <button onClick={() => h.setAsignando(d.id_descuento)} className="px-3 py-1.5 rounded-control bg-market/10 text-market-600 border border-market/30 text-[0.85rem] font-medium">
                Asignar a cliente/tipo
              </button>
              <button onClick={() => h.borrar(d)} className="px-3 py-1.5 rounded-control bg-achiote text-white text-[0.85rem] font-medium">
                Borrar
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Tramos</p>
            <div className="flex flex-wrap gap-2">
              {d.tramos.map((t, idx) => (
                <span key={idx} className="px-3 py-1 rounded-full bg-cream-100 border border-[var(--border)] text-sm text-ink">
                  {`${Number(t.cantidad_desde)}+ u. → ${Number(t.porcentaje)}%`}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink mb-2">Asignaciones</p>
            {d.asignaciones.length === 0 ? (
              <p className="text-sm text-ink-muted">Sin asignaciones. Aplica por defecto solo si se asigna.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {d.asignaciones.map((a) => (
                  <span key={a.id_asignacion} className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[var(--border)] text-sm text-ink">
                    {a.tipo_cliente ? `Tipo: ${a.tipo_cliente}` : `Cliente: ${a.nombre_cliente ?? a.id_cliente}`}
                    <button
                      onClick={() => h.quitarAsignacion(a.id_asignacion)}
                      className="text-achiote hover:underline text-xs"
                      aria-label="Quitar asignación"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
