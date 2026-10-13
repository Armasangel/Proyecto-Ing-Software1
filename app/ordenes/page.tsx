"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
<<<<<<< HEAD
import { staffVariantFromTipo } from "@/lib/roles";
import { CantidadInput } from "@/components/CantidadInput";
import { Icon } from "@/components/Icon";
=======
>>>>>>> develop

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
<<<<<<< HEAD
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
                Crear una orden de compra. Los productos se registran con cantidades y precios; el sistema asigna automaticamente la bodega con mas existencias de cada producto (se muestra en Ordenes recientes).
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={field}>
              <label style={label}>Cliente *</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    style={input}
                    placeholder="Escribe el nombre para buscar..."
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      setIdCliente("");
                      setSugerenciasAbiertas(true);
                      setError(null);
                      setOkMsg(null);
                    }}
                    onFocus={() => setSugerenciasAbiertas(true)}
                    onBlur={() => setTimeout(() => setSugerenciasAbiertas(false), 150)}
                  />
                  {sugerenciasAbiertas && busquedaCliente.trim() !== "" && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        marginTop: 2,
                        zIndex: 20,
                        maxHeight: 200,
                        overflowY: "auto",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                      }}
                    >
                      {clientesFiltrados.length === 0 && (
                        <div style={{ padding: "0.5rem 0.7rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                          Sin resultados — prueba &quot;+ Cliente nuevo&quot;.
                        </div>
                      )}
                      {clientesFiltrados.slice(0, 8).map((c) => (
                        <div
                          key={c.id_cliente}
                          onMouseDown={() => seleccionarCliente(c)}
                          style={{
                            padding: "0.45rem 0.7rem",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {c.nombre} {c.correo ? `(${c.correo})` : ""} {c.estado_cliente ? "" : "(bloqueado)"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCreandoCliente((v) => !v)}
                  style={{
                    padding: "0.3rem 0.8rem",
                    borderRadius: 6,
                    border: `1px solid ${accent}`,
                    background: "transparent",
                    color: accent,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  + Cliente nuevo
                </button>
              </div>

              {creandoCliente && (
                <div
                  style={{
                    padding: "0.75rem",
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    marginTop: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      style={input}
                      placeholder="Nombre *"
                      value={formCliente.nombre}
                      onChange={(e) => setFormCliente((f) => ({ ...f, nombre: e.target.value }))}
                    />
                    <input
                      style={input}
                      placeholder="Telefono"
                      value={formCliente.telefono}
                      onChange={(e) => setFormCliente((f) => ({ ...f, telefono: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      style={input}
                      placeholder="Correo (opcional)"
                      value={formCliente.correo}
                      onChange={(e) => setFormCliente((f) => ({ ...f, correo: e.target.value }))}
                    />
                    <select
                      style={input}
                      value={formCliente.tipo_cliente}
                      onChange={(e) => setFormCliente((f) => ({ ...f, tipo_cliente: e.target.value }))}
                    >
                      <option value="MINORISTA">Minorista</option>
                      <option value="MAYORISTA">Mayorista</option>
                    </select>
                  </div>
                  <div style={{ ...field, marginBottom: "0.5rem", maxWidth: 220 }}>
                    <label style={label}>Limite de deuda</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      style={input}
                      placeholder="500"
                      value={formCliente.limite_deuda}
                      onChange={(e) => setFormCliente((f) => ({ ...f, limite_deuda: e.target.value }))}
                    />
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: -4, marginBottom: "0.5rem" }}>
                    Por defecto queda con un limite de Q{LIMITE_DEUDA_DEFECTO} — puedes cambiarlo aqui o despues desde Deudas.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const nuevo = await crearCliente();
                        if (nuevo) seleccionarCliente(nuevo);
                      }}
                      disabled={guardandoCliente}
                      style={{
                        padding: "0.3rem 0.8rem",
                        borderRadius: 6,
                        background: "#52b788",
                        color: "#fff",
                        border: "none",
                        cursor: guardandoCliente ? "default" : "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      {guardandoCliente ? "Creando..." : "Crear cliente"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreandoCliente(false);
                        setFormCliente(clienteFormVacio);
                      }}
                      style={{
                        padding: "0.3rem 0.8rem",
                        borderRadius: 6,
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {clienteSeleccionado && (
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
                  {clienteSeleccionado.correo && <>{clienteSeleccionado.correo} · </>}
                  {clienteSeleccionado.tipo_cliente === "MAYORISTA" ? "Mayorista" : "Minorista"}
                </p>
              )}
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
                  const presentaciones = ln.id_producto ? presentacionesPorProducto[Number(ln.id_producto)] : undefined;
                  const factor = factorDeLinea(ln);
                  const qBase = cantidadBaseDeLinea(ln);
                  return (
                    <div key={ln.key} style={{ display: "grid", gridTemplateColumns: "1fr 160px 150px 120px auto", gap: "0.5rem", alignItems: "end" }}>
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
                        <label style={label}>Presentacion (opc.)</label>
                        <select
                          value={ln.id_presentacion}
                          onChange={(e) => { actualizarLinea(ln.key, { id_presentacion: e.target.value }); setError(null); setOkMsg(null); }}
                          style={input}
                          disabled={!ln.id_producto || !presentaciones || presentaciones.length === 0}
                        >
                          <option value="">-- Unidad base --</option>
                          {(presentaciones || []).map((p) => (
                            <option key={p.id_presentacion} value={p.id_presentacion}>
                              {p.nombre_presentacion} (x{p.factor_conversion})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={field}>
                        <label style={label}>Cantidad</label>
                        <CantidadInput
                          ariaLabel="Cantidad"
                          style={input}
                          value={ln.cantidad}
                          onChange={(cantidad) => actualizarLinea(ln.key, { cantidad })}
                        />
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
                          {factor > 1 && qBase > 0 && (
                            <> · Equivale a {qBase} {pSel.unidad_medida}</>
                          )}
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
=======
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
>>>>>>> develop
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
