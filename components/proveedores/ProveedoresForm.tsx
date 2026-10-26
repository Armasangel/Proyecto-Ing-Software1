"use client";

import { INPUT_CLS_PROVEEDOR } from "@/lib/constants/proveedores";
import type { useProveedores } from "@/hooks/useProveedores";

export function ProveedoresForm({ h }: { h: ReturnType<typeof useProveedores> }) {
  if (!h.creando && h.editando === null) return null;

  return (
    <div className="mb-6 bg-white border border-[var(--border)] rounded-card shadow-warm p-6 max-w-[720px]">
      <h3 className="mb-4 text-base font-semibold text-ink">{h.editando ? "Editar proveedor" : "Nuevo proveedor"}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-ink-muted mb-1">Nombre del proveedor</label>
          <input
            value={h.form.nombre_proveedor}
            onChange={(e) => h.setForm({ ...h.form, nombre_proveedor: e.target.value })}
            className={INPUT_CLS_PROVEEDOR}
          />
        </div>
        <div>
          <label className="block text-sm text-ink-muted mb-1">NIT</label>
          <input
            value={h.form.nit_proveedor}
            onChange={(e) => h.setForm({ ...h.form, nit_proveedor: e.target.value })}
            className={INPUT_CLS_PROVEEDOR}
          />
        </div>
        <div>
          <label className="block text-sm text-ink-muted mb-1">Correo de contacto</label>
          <input
            value={h.form.correo_contacto}
            onChange={(e) => h.setForm({ ...h.form, correo_contacto: e.target.value })}
            className={INPUT_CLS_PROVEEDOR}
          />
        </div>
        <div>
          <label className="block text-sm text-ink-muted mb-1">Teléfono</label>
          <input
            value={h.form.telefono}
            onChange={(e) => h.setForm({ ...h.form, telefono: e.target.value })}
            className={INPUT_CLS_PROVEEDOR}
          />
        </div>
      </div>
      {h.editando && (
        <div className="mt-4">
          <label htmlFor="estado-proveedor" className="block text-sm text-ink-muted mb-1">
            Estado
          </label>
          <select
            id="estado-proveedor"
            value={String(h.estadoProveedor)}
            onChange={(e) => h.setEstadoProveedor(e.target.value === "true")}
            className={INPUT_CLS_PROVEEDOR}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      )}
      <div className="mt-5 flex gap-3">
        <button
          onClick={h.guardar}
          className="px-5 py-2.5 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110"
        >
          Guardar
        </button>
        <button
          onClick={h.cancelar}
          className="px-5 py-2.5 rounded-control bg-cream-100 border border-[var(--border)] text-ink font-semibold text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
