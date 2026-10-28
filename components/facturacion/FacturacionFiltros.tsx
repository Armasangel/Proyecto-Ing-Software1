"use client";

import { inputClsTablaFacturacion } from "@/lib/constants/facturacion";
import type { FacturacionController } from "@/hooks/useFacturacion";

export function FacturacionFiltros({ f }: { f: FacturacionController }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={f.q}
        onChange={(e) => f.setQ(e.target.value)}
        placeholder="Buscar por cliente, código, correo o factura…"
        aria-label="Buscar en facturación"
        className={`${inputClsTablaFacturacion} flex-1 min-w-[220px]`}
      />
      <select value={f.filtroEstado} onChange={(e) => f.setFiltroEstado(e.target.value)} aria-label="Filtrar por estado" className={inputClsTablaFacturacion}>
        <option value="">Todos los estados</option>
        {f.estadosDisponibles.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={f.filtroFactura} onChange={(e) => f.setFiltroFactura(e.target.value)} aria-label="Filtrar por facturación" className={inputClsTablaFacturacion}>
        <option value="todas">Facturadas y sin facturar</option>
        <option value="facturadas">Facturadas</option>
        <option value="sin_facturar">Sin facturar</option>
      </select>
    </div>
  );
}
