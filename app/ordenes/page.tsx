"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

// Pedidos de entrega: cada venta con entrega a domicilio genera un pedido que
// recorre el flujo de bodega. Los pedidos NO se crean acá (se crean desde
// Ventas); esta pantalla solo da seguimiento y marca la entrega.

type DetalleOrdenRow = {
  id_detalle: number;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  id_bodega: number | null;
  nombre_bodega: string | null;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  id_presentacion: number | null;
  nombre_presentacion: string | null;
  cantidad_presentacion: string | null;
};

type OrdenListada = {
  id_orden: number;
  id_cliente: number;
  id_usuario: number | null;
  id_venta: number | null;
  fecha_orden: string;
  estado: string;
  notas: string | null;
  total: string;
  nombre_cliente: string;
  correo_cliente: string;
  tipo_cliente: string;
  codigo_cliente?: string | null;
  nit_cliente?: string | null;
  direccion?: string | null;
  nombre_usuario: string | null;
  productos: DetalleOrdenRow[];
};

const ACCENT = "#1D24CA";

const ESTADOS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const ESTADOS_COLOR: Record<string, string> = {
  PENDIENTE: "#e67700",
  CONFIRMADO: "#1D24CA",
  EN_PREPARACION: "#7b2cbf",
  ENVIADO: "#0077b6",
  ENTREGADO: "#2d6a4f",
  CANCELADO: "#c1121f",
};

const ACCIONES_DISPONIBLES: Record<string, { siguiente: string; label: string }[]> = {
  PENDIENTE: [
    { siguiente: "CONFIRMADO", label: "Confirmar" },
    { siguiente: "CANCELADO", label: "Cancelar" },
  ],
  CONFIRMADO: [
    { siguiente: "EN_PREPARACION", label: "Preparar" },
    { siguiente: "CANCELADO", label: "Cancelar" },
  ],
  EN_PREPARACION: [
    { siguiente: "ENVIADO", label: "Enviar" },
    { siguiente: "CANCELADO", label: "Cancelar" },
  ],
  ENVIADO: [{ siguiente: "ENTREGADO", label: "Marcar entregado" }],
};

export default function PedidosPage() {
  const usuario = useStaffSession();
  const [ordenes, setOrdenes] = useState<OrdenListada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const cargarOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ordenes");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar los pedidos");
      setOrdenes(d.ordenes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    cargarOrdenes();
  }, [usuario, cargarOrdenes]);

  async function cambiarEstado(idOrden: number, nuevoEstado: string) {
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/ordenes/${idOrden}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el pedido");
        return;
      }
      setOkMsg(`Pedido #${idOrden} actualizado a ${ESTADOS_LABEL[nuevoEstado] || nuevoEstado}`);
      await cargarOrdenes();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  if (!usuario) return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando...</p>;

  const th = { padding: "0.65rem 0.85rem", textAlign: "left" as const, fontSize: "0.82rem", fontWeight: 600 };
  const td = { padding: "0.6rem 0.85rem", fontSize: "0.88rem", borderBottom: "1px solid var(--border)" };

  return (
    <StaffShell usuario={usuario} title="Pedidos de entrega" subtitle="Seguimiento de las ventas con entrega a domicilio">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            padding: "0.8rem 1rem",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <span style={{ flex: 1, minWidth: 240, fontSize: "0.88rem", color: "var(--muted)" }}>
            Los pedidos se generan solos al registrar una venta con entrega <strong>a domicilio</strong> en Ventas.
            Aquí se les da seguimiento hasta la entrega.
          </span>
          <Link
            href="/ventas"
            style={{
              padding: "0.5rem 1.2rem",
              borderRadius: 10,
              background: ACCENT,
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Ir a Ventas
          </Link>
        </div>

        {error && <div style={{ color: "var(--red)", fontWeight: 600 }}>{error}</div>}
        {okMsg && <div style={{ color: "#2d6a4f", fontWeight: 600 }}>{okMsg}</div>}

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Cargando pedidos...</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ background: ACCENT, color: "#fff" }}>
                  <th style={th}>#</th>
                  <th style={th}>Venta</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Estado</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                  <th style={th}>Productos</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o, i) => (
                  <tr key={o.id_orden} style={{ background: i % 2 === 0 ? "var(--surface2)" : "var(--surface)", verticalAlign: "top" }}>
                    <td style={td}>{o.id_orden}</td>
                    <td style={td}>{o.id_venta ? `#${o.id_venta}` : "—"}</td>
                    <td style={td}>{new Date(o.fecha_orden).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{o.nombre_cliente}</div>
                      {o.codigo_cliente && (
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{o.codigo_cliente}</div>
                      )}
                      {o.nit_cliente && o.nit_cliente !== "CF" && (
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>NIT {o.nit_cliente}</div>
                      )}
                      {o.direccion && (
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{o.direccion}</div>
                      )}
                      {o.notas && <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{o.notas}</div>}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.6rem",
                          borderRadius: 6,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "#fff",
                          background: ESTADOS_COLOR[o.estado] || "#666",
                        }}
                      >
                        {ESTADOS_LABEL[o.estado] || o.estado}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>Q{Number(o.total).toFixed(2)}</td>
                    <td style={{ ...td, fontSize: "0.82rem", maxWidth: 320 }}>
                      {(o.productos || []).map((pr) => (
                        <div key={pr.id_detalle} style={{ marginBottom: "0.35rem" }}>
                          <span style={{ color: "var(--text)" }}>{pr.codigo_producto}</span> × {Number(pr.cantidad).toFixed(3)}
                          {pr.nombre_presentacion && pr.cantidad_presentacion && (
                            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                              {" "}({Number(pr.cantidad_presentacion).toFixed(0)} × {pr.nombre_presentacion})
                            </span>
                          )}
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                            {pr.nombre_bodega ? (
                              <>Sacar de: <strong style={{ color: ACCENT }}>{pr.nombre_bodega}</strong></>
                            ) : (
                              <span style={{ color: "var(--red)" }}>Sin bodega con stock registrado</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {(ACCIONES_DISPONIBLES[o.estado] || [])
                        // Un pedido que viene de una venta se cancela deshaciendo la venta (en Ventas).
                        .filter((acc) => !(acc.siguiente === "CANCELADO" && o.id_venta))
                        .map((acc) => (
                          <button
                            key={acc.siguiente}
                            type="button"
                            onClick={() => cambiarEstado(o.id_orden, acc.siguiente)}
                            style={{
                              display: "inline-block",
                              padding: "0.3rem 0.6rem",
                              marginRight: "0.4rem",
                              marginBottom: "0.3rem",
                              borderRadius: 6,
                              border: acc.siguiente === "CANCELADO" ? "1px solid var(--red)" : `1px solid ${ACCENT}`,
                              background: "transparent",
                              color: acc.siguiente === "CANCELADO" ? "var(--red)" : ACCENT,
                              fontWeight: 500,
                              fontSize: "0.78rem",
                              cursor: "pointer",
                            }}
                          >
                            {acc.label}
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ordenes.length === 0 && (
              <p style={{ padding: "1.25rem", color: "var(--muted)", margin: 0 }}>Aún no hay pedidos de entrega.</p>
            )}
          </div>
        )}
      </div>
    </StaffShell>
  );
}
