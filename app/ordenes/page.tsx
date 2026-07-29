"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo } from "@/lib/roles";
import { Icon } from "@/components/Icon";

type Cliente = {
  id_cliente: number;
  nombre: string;
  correo: string;
  tipo_cliente: string;
};

type Producto = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  estado_producto: boolean;
};

type Bodega = { id_bodega: number; nombre_bodega: string };

type LineaOrden = {
  key: string;
  id_producto: string;
  id_bodega: string;
  cantidad: string;
  precio_unitario: string;
};

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
};

type OrdenListada = {
  id_orden: number;
  id_cliente: number;
  id_usuario: number | null;
  fecha_orden: string;
  estado: string;
  notas: string | null;
  total: string;
  nombre_cliente: string;
  correo_cliente: string;
  tipo_cliente: string;
  nombre_usuario: string | null;
  productos: DetalleOrdenRow[];
};

const ACCENT = "#1D24CA";

const ESTADOS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparacion",
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
  ENVIADO: [
    { siguiente: "ENTREGADO", label: "Entregar" },
  ],
};

function nuevaLinea(): LineaOrden {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id_producto: "",
    id_bodega: "",
    cantidad: "",
    precio_unitario: "",
  };
}

export default function OrdenesPage() {
  const usuario = useStaffSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenListada[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [idCliente, setIdCliente] = useState("");
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<LineaOrden[]>([nuevaLinea()]);

  const cargarOrdenes = useCallback(async () => {
    setLoadingLista(true);
    try {
      const r = await fetch("/api/ordenes");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar ordenes");
      setOrdenes(d.ordenes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ordenes");
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/clientes").then((r) => r.json()).then((d) => setClientes(d.clientes || []));
    fetch("/api/productos").then((r) => r.json()).then((d) => setProductos(d.productos || []));
    fetch("/api/bodegas").then((r) => r.json()).then((d) => setBodegas(d.bodegas || []));
    cargarOrdenes();
  }, [usuario, cargarOrdenes]);

  const productoPorId = useMemo(() => {
    const m = new Map<number, Producto>();
    productos.forEach((p) => m.set(p.id_producto, p));
    return m;
  }, [productos]);

  const totalBorrador = useMemo(() => {
    let t = 0;
    for (const ln of lineas) {
      const q = Number(ln.cantidad);
      const pu = Number(ln.precio_unitario);
      if (q > 0 && pu >= 0 && !Number.isNaN(q) && !Number.isNaN(pu)) {
        t += Math.round(q * pu * 100) / 100;
      }
    }
    return Math.round(t * 100) / 100;
  }, [lineas]);

  if (!usuario) return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando...</p>;

  const accent = ACCENT;

  function precioSugerido(p: Producto | undefined): string {
    if (!p) return "";
    const v = Number(p.precio_unitario);
    if (Number.isNaN(v)) return "";
    return String(v);
  }

  function actualizarLinea(key: string, patch: Partial<LineaOrden>) {
    setLineas((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    setError(null);
    setOkMsg(null);
  }

  function onProductoChange(key: string, idStr: string) {
    const id = Number(idStr);
    const p = productoPorId.get(id);
    setLineas((prev) =>
      prev.map((ln) =>
        ln.key === key
          ? { ...ln, id_producto: idStr, precio_unitario: p ? precioSugerido(p) : ln.precio_unitario }
          : ln
      )
    );
    setError(null);
    setOkMsg(null);
  }

  async function handleSubmit() {
    setLoadingSubmit(true);
    setError(null);
    setOkMsg(null);
    try {
      const lineasPayload = lineas
        .filter((ln) => ln.id_producto && ln.cantidad && ln.precio_unitario)
        .map((ln) => ({
          id_producto: Number(ln.id_producto),
          id_bodega: ln.id_bodega ? Number(ln.id_bodega) : null,
          cantidad: Number(ln.cantidad),
          precio_unitario: Number(ln.precio_unitario),
        }));
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cliente: Number(idCliente),
          notas: notas.trim() || undefined,
          lineas: lineasPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear la orden");
        return;
      }
      setOkMsg(`Orden #${data.id_orden} creada. Total: Q${Number(data.total).toFixed(2)}`);
      setIdCliente("");
      setNotas("");
      setLineas([nuevaLinea()]);
      await cargarOrdenes();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoadingSubmit(false);
    }
  }

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
        setError(data.error || "No se pudo actualizar la orden");
        return;
      }
      setOkMsg(`Orden #${idOrden} actualizada a ${ESTADOS_LABEL[nuevoEstado] || nuevoEstado}`);
      await cargarOrdenes();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  const puedeEnviar =
    idCliente &&
    lineas.some((ln) => ln.id_producto && ln.cantidad && Number(ln.cantidad) > 0);

  const th = { padding: "0.65rem 0.85rem", textAlign: "left" as const, fontSize: "0.82rem", fontWeight: 600 };
  const td = { padding: "0.6rem 0.85rem", fontSize: "0.88rem", borderBottom: "1px solid var(--border)" };

  return (
    <StaffShell usuario={usuario} title="Ordenes" subtitle="Gestion de ordenes de compra (dueno y colaborador)">
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Formulario de creacion */}
        <div style={{ maxWidth: 780, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", borderBottom: `2px solid ${accent}`, paddingBottom: "1rem" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${accent}18`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="bill" variant="dark" size={26} />
            </div>
            <div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
                Crear una orden de compra. Los productos se registran con cantidades y precios; la bodega es opcional hasta confirmar la preparacion.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={field}>
              <label style={label}>Cliente *</label>
              <select
                value={idCliente}
                onChange={(e) => { setIdCliente(e.target.value); setError(null); setOkMsg(null); }}
                style={input}
              >
                <option value="">-- Selecciona un cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id_cliente} value={c.id_cliente}>
                    {c.nombre} ({c.correo})
                  </option>
                ))}
              </select>
            </div>

            <div style={field}>
              <label style={label}>Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Instrucciones, referencias..."
                rows={2}
                style={{ ...input, resize: "vertical" }}
              />
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.75rem", color: "var(--text)" }}>Productos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {lineas.map((ln) => {
                  const pSel = ln.id_producto ? productoPorId.get(Number(ln.id_producto)) : undefined;
                  return (
                    <div key={ln.key} style={{ display: "grid", gridTemplateColumns: "1fr 140px 100px 120px auto", gap: "0.5rem", alignItems: "end" }}>
                      <div style={field}>
                        <label style={label}>Producto</label>
                        <select value={ln.id_producto} onChange={(e) => onProductoChange(ln.key, e.target.value)} style={input}>
                          <option value="">-- Producto --</option>
                          {productos.filter((p) => p.estado_producto).map((p) => (
                            <option key={p.id_producto} value={p.id_producto}>
                              [{p.codigo_producto}] {p.nombre_producto}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={field}>
                        <label style={label}>Bodega (opc.)</label>
                        <select value={ln.id_bodega} onChange={(e) => { actualizarLinea(ln.key, { id_bodega: e.target.value }); setError(null); setOkMsg(null); }} style={input}>
                          <option value="">-- Sin asignar --</option>
                          {bodegas.map((b) => (
                            <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>
                          ))}
                        </select>
                      </div>
                      <div style={field}>
                        <label style={label}>Cantidad</label>
                        <input type="number" min="0.001" step="0.001" value={ln.cantidad} onChange={(e) => actualizarLinea(ln.key, { cantidad: e.target.value })} style={input} />
                      </div>
                      <div style={field}>
                        <label style={label}>P. unitario</label>
                        <input type="number" min="0" step="0.01" value={ln.precio_unitario} onChange={(e) => actualizarLinea(ln.key, { precio_unitario: e.target.value })} style={input} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLineas((prev) => prev.length <= 1 ? prev : prev.filter((x) => x.key !== ln.key))}
                        disabled={lineas.length <= 1}
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--surface2)",
                          color: "var(--muted)",
                          cursor: lineas.length <= 1 ? "not-allowed" : "pointer",
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Quitar linea"
                      >
                        <Icon name="close" variant="dark" size={14} />
                      </button>
                      {pSel && (
                        <span style={{ gridColumn: "1 / -1", fontSize: "0.78rem", color: "var(--muted)" }}>
                          Unidad: {pSel.unidad_medida}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setLineas((prev) => [...prev, nuevaLinea()])}
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.85rem",
                  borderRadius: 8,
                  border: `1px solid ${accent}`,
                  background: "transparent",
                  color: accent,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.88rem",
                }}
              >
                + Agregar producto
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>Total: Q{totalBorrador.toFixed(2)}</span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loadingSubmit || !puedeEnviar}
                style={{
                  background: accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.85rem 1.25rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: loadingSubmit || !puedeEnviar ? "not-allowed" : "pointer",
                  opacity: loadingSubmit || !puedeEnviar ? 0.55 : 1,
                }}
              >
                {loadingSubmit ? "Guardando..." : "Crear orden"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: "1rem", background: "rgba(248,81,73,.12)", border: "1px solid rgba(248,81,73,.3)", borderRadius: 8, padding: "0.75rem 1rem", color: "var(--red)" }}>
              {error}
            </div>
          )}
          {okMsg && (
            <div style={{ marginTop: "1rem", background: "rgba(63,185,80,.12)", border: "1px solid rgba(63,185,80,.35)", borderRadius: 8, padding: "0.75rem 1rem", color: "var(--green)" }}>
              {okMsg}
            </div>
          )}
        </div>

        {/* Lista de ordenes */}
        <div>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.15rem", marginBottom: "1rem", color: accent }}>Ordenes recientes</h2>
          {loadingLista ? (
            <p style={{ color: "var(--muted)" }}>Cargando ordenes...</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                <thead>
                  <tr style={{ background: accent, color: "#fff" }}>
                    <th style={th}>#</th>
                    <th style={th}>Fecha</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Creado por</th>
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
                      <td style={td}>{new Date(o.fecha_orden).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>{o.nombre_cliente}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{o.correo_cliente}</div>
                      </td>
                      <td style={td}>{o.nombre_usuario ?? "---"}</td>
                      <td style={td}>
                        <span style={{
                          display: "inline-block",
                          padding: "0.2rem 0.6rem",
                          borderRadius: 6,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "#fff",
                          background: ESTADOS_COLOR[o.estado] || "#666",
                        }}>
                          {ESTADOS_LABEL[o.estado] || o.estado}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>Q{Number(o.total).toFixed(2)}</td>
                      <td style={{ ...td, fontSize: "0.82rem", maxWidth: 320 }}>
                        {(o.productos || []).map((pr) => (
                          <div key={pr.id_detalle} style={{ marginBottom: "0.35rem" }}>
                            <span style={{ color: "var(--text)" }}>{pr.codigo_producto}</span>{" "}
                            x {Number(pr.cantidad).toFixed(3)} @ Q{Number(pr.precio_unitario).toFixed(2)}{" "}
                            {"->"} Q{Number(pr.subtotal).toFixed(2)}
                            {pr.nombre_bodega && (
                              <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}> [{pr.nombre_bodega}]</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {(ACCIONES_DISPONIBLES[o.estado] || []).map((acc) => (
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
                              border: acc.siguiente === "CANCELADO" ? "1px solid var(--red)" : `1px solid ${accent}`,
                              background: acc.siguiente === "CANCELADO" ? "transparent" : "transparent",
                              color: acc.siguiente === "CANCELADO" ? "var(--red)" : accent,
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
                <p style={{ padding: "1.25rem", color: "var(--muted)", margin: 0 }}>Aun no hay ordenes registradas.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.35rem" };
const label: React.CSSProperties = { fontWeight: 600, fontSize: "0.88rem", color: "var(--muted)" };
const input: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: "0.95rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
