"use client";

import { BTN_GHOST_DESCUENTO, BTN_PRIMARY_DESCUENTO, INPUT_CLS_DESCUENTO } from "@/lib/constants/descuentos";
import { TIPOS_CLIENTE } from "@/lib/tipos-cliente";
import type { useDescuentos } from "@/hooks/useDescuentos";

export function DescuentosAsignaciones({ h }: { h: ReturnType<typeof useDescuentos> }) {
  if (h.asignando == null) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-card border border-[var(--border)] bg-white p-6 shadow-warm">
        <h3 className="text-base font-semibold text-ink mb-2">Asignar descuento</h3>
        <p className="text-sm text-ink-muted mb-4">Selecciona un cliente específico o un tipo de cliente.</p>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm text-ink-muted mb-1">Cliente</label>
            <select
              value={h.asigSel.id_cliente}
              onChange={(e) => h.setAsigSel({ id_cliente: e.target.value, tipo_cliente: "" })}
              className={INPUT_CLS_DESCUENTO}
              aria-label="Cliente"
            >
              <option value="">— Ninguno —</option>
              {h.clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.nombre} ({c.tipo_cliente})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-ink-muted mb-1">O por tipo de cliente</label>
            <select
              value={h.asigSel.tipo_cliente}
              onChange={(e) => h.setAsigSel({ id_cliente: "", tipo_cliente: e.target.value })}
              className={INPUT_CLS_DESCUENTO}
              disabled={!!h.asigSel.id_cliente}
              aria-label="Tipo de cliente"
            >
              <option value="">— Ninguno —</option>
              {TIPOS_CLIENTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={h.asignar} className={BTN_PRIMARY_DESCUENTO}>
            Guardar asignación
          </button>
          <button
            onClick={() => {
              h.setAsignando(null);
              h.setAsigSel({ id_cliente: "", tipo_cliente: "" });
            }}
            className={BTN_GHOST_DESCUENTO}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
