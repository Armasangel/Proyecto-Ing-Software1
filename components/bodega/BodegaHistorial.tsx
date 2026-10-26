"use client";

import { MOTIVO_LABEL } from "@/lib/constants/bodega";
import { s } from "@/lib/styles/bodega";
import type { useBodega } from "@/hooks/useBodega";

export function BodegaHistorial({ h }: { h: ReturnType<typeof useBodega> }) {
  return (
    <div style={s.historial}>
      <div style={s.historialTitle}>Últimos movimientos de tu bodega</div>
      {h.historial.length === 0 && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Sin movimientos recientes</div>}
      {h.historial.map((m) => (
        <div key={m.id_kardex} style={s.historialRow}>
          <div>
            <span style={{ fontWeight: 700, color: m.tipo_movimiento === "SALIDA" ? "var(--red)" : "var(--accent2)" }}>
              {m.tipo_movimiento === "SALIDA" ? "− " : "+ "}
              {Number(m.cantidad).toLocaleString("es-GT")} {m.unidad_medida}
            </span>{" "}
            {m.nombre_producto}
            {m.nombre_presentacion && (
              <span style={{ color: "var(--muted)" }}>
                {" "}
                ({m.cantidad_presentacion} × {m.nombre_presentacion})
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {m.motivo ? MOTIVO_LABEL[m.motivo] + " — " : ""}
            {m.descripcion || ""}
            {" · "}
            {new Date(m.fecha_movimiento).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
          </div>
        </div>
      ))}
    </div>
  );
}
