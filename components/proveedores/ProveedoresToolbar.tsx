"use client";

import { INPUT_CLS_PROVEEDOR_TOOLBAR } from "@/lib/constants/proveedores";
import type { useProveedores } from "@/hooks/useProveedores";

export function ProveedoresToolbar({ h }: { h: ReturnType<typeof useProveedores> }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[240px] max-w-[420px]">
        <input
          id="buscar-proveedores"
          type="search"
          value={h.q}
          onChange={(e) => h.setQ(e.target.value)}
          placeholder="Buscar por nombre, NIT, correo o teléfono..."
          className={INPUT_CLS_PROVEEDOR_TOOLBAR + " w-full pr-9"}
          aria-label="Buscar en proveedores"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <select
        value={h.filtroEstado}
        onChange={(e) => h.setFiltroEstado(e.target.value)}
        className={INPUT_CLS_PROVEEDOR_TOOLBAR}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        {h.estadosDisponibles.map((estado) => (
          <option key={String(estado)} value={String(estado)}>
            {estado ? "Activos" : "Inactivos"}
          </option>
        ))}
      </select>
    </div>
  );
}
