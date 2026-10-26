"use client";

import { COLUMNAS_PEDIDOS } from "@/lib/constants/bodega";
import { s } from "@/lib/styles/bodega";
import type { useBodega } from "@/hooks/useBodega";

export function BodegaPedidosBoard({ h }: { h: ReturnType<typeof useBodega> }) {
  return (
    <div style={s.pedidosBoard}>
      {h.pedidosError && (
        <div style={{ ...s.msgBox, borderColor: "var(--red)", color: "var(--red)" }}>{h.pedidosError}</div>
      )}
      <div style={s.pedidosColumns}>
        {COLUMNAS_PEDIDOS.map((col) => {
          const items = h.pedidos.filter((p) => p.estado === col.estado);
          return (
            <div key={col.estado} style={s.pedidosColumn}>
              <div style={s.pedidosColumnHeader}>
                {col.titulo} <span style={{ opacity: 0.6 }}>({items.length})</span>
              </div>
              <div style={s.pedidosColumnBody}>
                {items.length === 0 && (
                  <div style={{ color: "var(--muted)", fontSize: "0.82rem", padding: "0.5rem" }}>Sin pedidos aquí</div>
                )}
                {items.map((p) => (
                  <div key={p.id_orden} style={s.pedidoCard}>
                    <div style={s.pedidoCardHeader}>
                      <span style={{ fontWeight: 700 }}>Pedido #{p.id_orden}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {new Date(p.fecha_orden).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
                      {p.codigo_cliente ? `${p.codigo_cliente} · ` : ""}
                      {p.nombre_cliente}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "0.6rem" }}>
                      {p.productos
                        .filter((pr) => pr.es_mi_bodega)
                        .map((pr) => (
                          <div key={pr.id_detalle} style={{ fontSize: "0.85rem" }}>
                            <strong>{Number(pr.cantidad).toLocaleString("es-GT")}</strong> {pr.unidad_medida} —{" "}
                            {pr.nombre_producto}
                          </div>
                        ))}
                    </div>
                    {p.notas && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--muted)",
                          fontStyle: "italic",
                          marginBottom: "0.6rem",
                        }}
                      >
                        &ldquo;{p.notas}&rdquo;
                      </div>
                    )}
                    {col.siguiente && (
                      <button
                        type="button"
                        onClick={() => h.avanzarPedido(p.id_orden, col.siguiente!.estado)}
                        disabled={h.avanzandoId === p.id_orden}
                        style={s.pedidoAdvanceBtn}
                      >
                        {h.avanzandoId === p.id_orden ? "Actualizando…" : col.siguiente.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
