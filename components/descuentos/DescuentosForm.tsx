"use client";

import { useMemo } from "react";
import {
  BTN_GHOST_DESCUENTO,
  BTN_MINI_DESCUENTO,
  BTN_PRIMARY_DESCUENTO,
  INPUT_CLS_DESCUENTO,
  INPUT_CLS_DESCUENTO_SM,
  TIPOS_DESCUENTO,
} from "@/lib/constants/descuentos";
import type { useDescuentos } from "@/hooks/useDescuentos";
import type { Descuento } from "@/lib/types/descuentos";

export function DescuentosForm({ h }: { h: ReturnType<typeof useDescuentos> }) {
  const tipoActual = useMemo(() => TIPOS_DESCUENTO.find((t) => t.valor === h.form.tipo), [h.form.tipo]);

  if (!h.formularioAbierto) return null;

  return (
    <div className="mb-6 bg-white border border-[var(--border)] rounded-card shadow-warm p-6 max-w-[820px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-ink">{h.creando ? "Crear descuento" : "Editar descuento"}</h3>
          {tipoActual && <p className="text-sm text-ink-muted mt-1">{tipoActual.ayuda}</p>}
        </div>
        <button onClick={h.cerrarFormulario} className={BTN_GHOST_DESCUENTO}>
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm text-ink-muted mb-1">Nombre del descuento</label>
          <input
            value={h.form.nombre}
            onChange={(e) => h.setForm({ ...h.form, nombre: e.target.value })}
            className={INPUT_CLS_DESCUENTO}
            aria-label="Nombre del descuento"
          />
        </div>
        <div>
          <label className="block text-sm text-ink-muted mb-1">Tipo</label>
          <select
            value={h.form.tipo}
            onChange={(e) => h.cambiarTipo(e.target.value as Descuento["tipo"])}
            className={INPUT_CLS_DESCUENTO}
            aria-label="Tipo"
          >
            {TIPOS_DESCUENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-ink">Tramos / configuración</p>
          {h.form.tipo !== "PORCENTAJE" && (
            <button onClick={h.agregarTramo} className={BTN_MINI_DESCUENTO + " bg-market/10 text-market-600 border border-market/30"}>
              + Agregar tramo
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {h.form.tramos.map((tramo, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              {h.form.tipo === "PORCENTAJE" && (
                <>
                  <span className="text-sm text-ink-muted w-[110px]">Desde 0 unidades</span>
                  <input value={tramo.porcentaje} onChange={(e) => h.actualizarTramo(idx, "porcentaje", e.target.value)} placeholder="Porcentaje (ej. 5)" className={INPUT_CLS_DESCUENTO_SM + " w-[160px]"} aria-label="Porcentaje" />
                  <span className="text-sm text-ink-muted">%</span>
                </>
              )}
              {h.form.tipo === "CANTIDAD" && (
                <>
                  <input value={tramo.cantidad_desde} onChange={(e) => h.actualizarTramo(idx, "cantidad_desde", e.target.value)} placeholder="Cantidad mínima" className={INPUT_CLS_DESCUENTO_SM + " w-[160px]"} aria-label="Cantidad desde" />
                  <span className="text-sm text-ink-muted">unidades o más</span>
                  <input value={tramo.porcentaje} onChange={(e) => h.actualizarTramo(idx, "porcentaje", e.target.value)} placeholder="Porcentaje" className={INPUT_CLS_DESCUENTO_SM + " w-[140px]"} />
                  <span className="text-sm text-ink-muted">%</span>
                  {idx > 0 && (
                    <button onClick={() => h.eliminarTramo(idx)} className={BTN_MINI_DESCUENTO + " bg-achiote/10 text-achiote border border-achiote/30"}>
                      Eliminar
                    </button>
                  )}
                </>
              )}
              {h.form.tipo === "ESCALA" && (
                <>
                  <span className="text-sm text-ink-muted">Desde</span>
                  <input value={tramo.cantidad_desde} onChange={(e) => h.actualizarTramo(idx, "cantidad_desde", e.target.value)} className={INPUT_CLS_DESCUENTO_SM + " w-[120px]"} aria-label="Cantidad desde" />
                  <span className="text-sm text-ink-muted">unidades</span>
                  <input value={tramo.porcentaje} onChange={(e) => h.actualizarTramo(idx, "porcentaje", e.target.value)} placeholder="Porcentaje" className={INPUT_CLS_DESCUENTO_SM + " w-[140px]"} />
                  <span className="text-sm text-ink-muted">%</span>
                  {h.form.tramos.length > 1 && (
                    <button onClick={() => h.eliminarTramo(idx)} className={BTN_MINI_DESCUENTO + " bg-achiote/10 text-achiote border border-achiote/30"}>
                      Eliminar
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={h.guardar} className={BTN_PRIMARY_DESCUENTO}>
          Guardar descuento
        </button>
        <button onClick={h.cerrarFormulario} className={BTN_GHOST_DESCUENTO}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
