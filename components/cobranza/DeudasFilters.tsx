"use client";

import type { DeudoresFilters } from "@/lib/cobranza/deudores-query";

type Props = {
  filters: DeudoresFilters;
  onChange: (next: DeudoresFilters) => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.55rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "0.85rem",
};

export function DeudasFilters({
  filters,
  onChange,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.6rem",
        alignItems: "flex-end",
        marginBottom: "1rem",
      }}
    >
      <label style={{ fontSize: "0.82rem" }}>
        Buscar cliente
        <input
          type="search"
          placeholder="Nombre…"
          value={filters.q ?? ""}
          onChange={(e) => onChange({ ...filters, q: e.target.value, page: 1 })}
          style={{ ...inputStyle, display: "block", marginTop: 4, minWidth: 160 }}
        />
      </label>

      <label style={{ fontSize: "0.82rem" }}>
        Estado
        <select
          value={filters.estado ?? ""}
          onChange={(e) =>
            onChange({ ...filters, estado: e.target.value || undefined, page: 1 })
          }
          style={{ ...inputStyle, display: "block", marginTop: 4 }}
        >
          <option value="">Todos</option>
          <option value="activo">Activo</option>
          <option value="vencido">Vencido</option>
          <option value="critico">Crítico</option>
        </select>
      </label>

      <label style={{ fontSize: "0.82rem" }}>
        Desde
        <input
          type="date"
          value={filters.fecha_desde ?? ""}
          onChange={(e) =>
            onChange({ ...filters, fecha_desde: e.target.value || undefined, page: 1 })
          }
          style={{ ...inputStyle, display: "block", marginTop: 4 }}
        />
      </label>

      <label style={{ fontSize: "0.82rem" }}>
        Hasta
        <input
          type="date"
          value={filters.fecha_hasta ?? ""}
          onChange={(e) =>
            onChange({ ...filters, fecha_hasta: e.target.value || undefined, page: 1 })
          }
          style={{ ...inputStyle, display: "block", marginTop: 4 }}
        />
      </label>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          padding: "0.45rem 0.85rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          cursor: refreshing ? "wait" : "pointer",
          fontSize: "0.82rem",
        }}
      >
        {refreshing ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  );
}
