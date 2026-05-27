"use client";

import type { Deudor } from "./types";
import { badgeEstadoCobro, formatFecha, formatQuetzales } from "./format";
import type { DeudoresSort } from "@/lib/cobranza/deudores-query";

type Props = {
  deudores: Deudor[];
  cargando: boolean;
  sort?: string;
  order?: string;
  onSort: (column: DeudoresSort) => void;
  onPagar: (deudor: Deudor) => void;
};

const SORTABLE: { key: DeudoresSort; label: string }[] = [
  { key: "fecha_limite_pago", label: "Límite pago" },
  { key: "monto", label: "Pendiente" },
  { key: "dias_atraso", label: "Días atraso" },
];

function sortIndicator(active: boolean, order?: string) {
  if (!active) return " ↕";
  return order === "desc" ? " ↓" : " ↑";
}

export function DeudasTable({
  deudores,
  cargando,
  sort,
  order,
  onSort,
  onPagar,
}: Props) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.88rem",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "0.6rem" }}>Venta</th>
            <th style={{ padding: "0.6rem" }}>Cliente</th>
            {SORTABLE.map((col) => (
              <th key={col.key} style={{ padding: "0.6rem" }}>
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "inherit",
                    font: "inherit",
                    fontWeight: 600,
                  }}
                >
                  {col.label}
                  {sortIndicator(sort === col.key, order)}
                </button>
              </th>
            ))}
            <th style={{ padding: "0.6rem" }}>Estado</th>
            <th style={{ padding: "0.6rem" }}>Total</th>
            <th style={{ padding: "0.6rem" }}>Pagado</th>
            <th style={{ padding: "0.6rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr>
              <td colSpan={9} style={{ padding: "1rem", color: "var(--muted)" }}>
                Cargando deudas…
              </td>
            </tr>
          ) : deudores.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: "1rem", color: "var(--muted)" }}>
                No hay deudas con estos filtros.
              </td>
            </tr>
          ) : (
            deudores.map((d) => (
              <tr
                key={d.id_venta}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={{ padding: "0.6rem" }}>#{d.id_venta}</td>
                <td style={{ padding: "0.6rem" }}>{d.nombre_cliente}</td>
                <td style={{ padding: "0.6rem" }}>
                  {formatFecha(d.fecha_limite_pago)}
                </td>
                <td style={{ padding: "0.6rem", fontWeight: 600 }}>
                  Q{formatQuetzales(d.deuda_pendiente)}
                </td>
                <td style={{ padding: "0.6rem" }}>
                  {d.dias_atraso > 0 ? d.dias_atraso : "—"}
                </td>
                <td style={{ padding: "0.6rem" }}>
                  <span
                    style={{
                      ...badgeEstadoCobro(d.estado_cobro),
                      padding: "0.15rem 0.45rem",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {d.estado_cobro}
                  </span>
                </td>
                <td style={{ padding: "0.6rem" }}>Q{formatQuetzales(d.total_venta)}</td>
                <td style={{ padding: "0.6rem" }}>Q{formatQuetzales(d.total_pagado)}</td>
                <td style={{ padding: "0.6rem" }}>
                  <button
                    type="button"
                    onClick={() => onPagar(d)}
                    style={{
                      padding: "0.3rem 0.65rem",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Pagar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
