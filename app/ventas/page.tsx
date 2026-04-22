"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo, TIPOS_USUARIO } from "@/lib/roles";

type Cliente = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
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

type LineaVenta = {
  key: string;
  id_producto: string;
  cantidad: string;
  precio_unitario_venta: string;
};

type ProductoVentaRow = {
  id_detalle: number;
  id_venta: number;
  codigo_producto: string;
  id_producto: number;
  cantidad: string;
  precio_unitario_venta: string;
  subtotal: string;
};

type VentaListada = {
  id_venta: number;
  id_usuario: number;
  id_empleado: number | null;
  fecha_venta: string;
  estado_venta: string;
  tipo_venta: string;
  tipo_entrega: string;
  direccion_entrega: string | null;
  total: string;
  fecha_limite_pago: string | null;
  nombre_cliente: string;
  correo_cliente: string;
  nombre_colaborador: string | null;
  productos: ProductoVentaRow[];
};

const ACCENT = {
  dueno: "#2d6a4f",
  colaborador: "#4c6ef5",
} as const;

const ESTADOS = [
  { value: "PAGADO", label: "Pagado" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "ENTREGADO", label: "Entregado" },
] as const;

function nuevaLinea(): LineaVenta {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id_producto: "",
    cantidad: "",
    precio_unitario_venta: "",
  };
}

export default function VentasPage() {
  const usuario = useStaffSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [ventas, setVentas] = useState<VentaListada[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [idCliente, setIdCliente] = useState("");
  const [estadoPago, setEstadoPago] = useState<string>("PAGADO");
  const [tipoVenta, setTipoVenta] = useState<string>("MINORISTA");
  const [tipoEntrega, setTipoEntrega] = useState<string>("EN_TIENDA");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [fechaLimitePago, setFechaLimitePago] = useState("");
  const [idBodega, setIdBodega] = useState("");
  const [lineas, setLineas] = useState<LineaVenta[]>([nuevaLinea()]);

  const cargarVentas = useCallback(async () => {
    setLoadingLista(true);
    try {
      const r = await fetch("/api/ventas");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar ventas");
      setVentas(d.ventas || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ventas");
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((d) => setClientes(d.clientes || []));
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []));
    fetch("/api/bodegas")
      .then((r) => r.json())
      .then((d) => setBodegas(d.bodegas || []));
    cargarVentas();
  }, [usuario, cargarVentas]);

  const productoPorId = useMemo(() => {
    const m = new Map<number, Producto>();
    productos.forEach((p) => m.set(p.id_producto, p));
    return m;
  }, [productos]);

  const totalBorrador = useMemo(() => {
    let t = 0;
    for (const ln of lineas) {
      const q = Number(ln.cantidad);
      const pu = Number(ln.precio_unitario_venta);
      if (q > 0 && pu >= 0 && !Number.isNaN(q) && !Number.isNaN(pu)) {
        t += Math.round(q * pu * 100) / 100;
      }
    }
    return Math.round(t * 100) / 100;
  }, [lineas]);

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const accent = ACCENT[staffVariantFromTipo(usuario.tipo_usuario)];
  const esDueno = usuario.tipo_usuario === TIPOS_USUARIO.DUENO;

  function precioSugerido(p: Producto | undefined): string {
    if (!p) return "";
    const v =
      tipoVenta === "MAYORISTA"
        ? Number(p.precio_mayoreo)
        : Number(p.precio_unitario);
    if (Number.isNaN(v)) return "";
    return String(v);
  }

  function actualizarLinea(key: string, patch: Partial<LineaVenta>) {
    setLineas((prev) =>
      prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln))
    );
    setError(null);
    setOkMsg(null);
  }

  function onProductoChange(key: string, idStr: string) {
    const id = Number(idStr);
    const p = productoPorId.get(id);
    setLineas((prev) =>
      prev.map((ln) =>
        ln.key === key
          ? {
              ...ln,
              id_producto: idStr,
              precio_unitario_venta: p ? precioSugerido(p) : ln.precio_unitario_venta,
            }
          : ln
      )
    );
    setError(null);
    setOkMsg(null);
  }

  function aplicarPreciosPorTipo(nuevoTipo: string) {
    setLineas((prev) =>
      prev.map((ln) => {
        if (!ln.id_producto) return ln;
        const p = productoPorId.get(Number(ln.id_producto));
        if (!p) return ln;
        const v =
          nuevoTipo === "MAYORISTA"
            ? Number(p.precio_mayoreo)
            : Number(p.precio_unitario);
        if (Number.isNaN(v)) return ln;
        return { ...ln, precio_unitario_venta: String(v) };
      })
    );
  }

  async function handleSubmit() {
    setLoadingSubmit(true);
    setError(null);
    setOkMsg(null);
    try {
      const lineasPayload = lineas
        .filter((ln) => ln.id_producto && ln.cantidad && ln.precio_unitario_venta)
        .map((ln) => ({
          id_producto: Number(ln.id_producto),
          cantidad: Number(ln.cantidad),
          precio_unitario_venta: Number(ln.precio_unitario_venta),
        }));

      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: Number(idCliente),
          estado_pago: estadoPago,
          tipo_venta: tipoVenta,
          tipo_entrega: tipoEntrega,
          direccion_entrega:
            tipoEntrega === "DOMICILIO" ? direccionEntrega.trim() : undefined,
          fecha_limite_pago: fechaLimitePago || undefined,
          id_bodega: Number(idBodega),
          lineas: lineasPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo registrar la venta");
        return;
      }
      setOkMsg(`Venta #${data.id_venta} registrada. Total: Q${Number(data.total).toFixed(2)}`);
      setIdCliente("");
      setEstadoPago("PAGADO");
      setTipoVenta("MINORISTA");
      setTipoEntrega("EN_TIENDA");
      setDireccionEntrega("");
      setFechaLimitePago("");
      setLineas([nuevaLinea()]);
      await cargarVentas();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoadingSubmit(false);
    }
  }

  const puedeEnviar =
    idCliente &&
    idBodega &&
    lineas.some(
      (ln) => ln.id_producto && ln.cantidad && Number(ln.cantidad) > 0
    ) &&
    (tipoEntrega === "EN_TIENDA" || direccionEntrega.trim().length > 0);

  const th = {
    padding: "0.65rem 0.85rem",
    textAlign: "left" as const,
    fontSize: "0.82rem",
    fontWeight: 600,
  };

  const td = {
    padding: "0.6rem 0.85rem",
    fontSize: "0.88rem",
    borderBottom: "1px solid var(--border)",
  };

  return (
    <StaffShell
      usuario={usuario}
      title="Ventas"
      subtitle={
        esDueno
          ? "Registro de transacciones y detalle por producto (dueño)"
          : "Registro de ventas y control de transacciones (colaborador)"
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div
          style={{
            maxWidth: 720,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "1.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1.5rem",
              borderBottom: `2px solid ${accent}`,
              paddingBottom: "1rem",
            }}
          >
            <span style={{ fontSize: "2.2rem" }}>🧾</span>
            <div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
                Cada venta guarda la transacción (<code>venta</code>) y los productos (
                <code>detalle_venta</code>). El inventario de la bodega seleccionada se
                descuenta y queda trazado en kardex.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={field}>
              <label style={label}>Cliente *</label>
              <select
                value={idCliente}
                onChange={(e) => {
                  setIdCliente(e.target.value);
                  setError(null);
                  setOkMsg(null);
                }}
                style={input}
              >
                <option value="">— Selecciona un cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id_usuario} value={c.id_usuario}>
                    {c.nombre} ({c.correo})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ ...field, flex: "1 1 200px" }}>
                <label style={label}>Estado de pago *</label>
                <select
                  value={estadoPago}
                  onChange={(e) => {
                    setEstadoPago(e.target.value);
                    setError(null);
                  }}
                  style={input}
                >
                  {ESTADOS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  En base de datos: <code>estado_venta</code>
                </span>
              </div>
              <div style={{ ...field, flex: "1 1 200px" }}>
                <label style={label}>Tipo de venta *</label>
                <select
                  value={tipoVenta}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTipoVenta(v);
                    aplicarPreciosPorTipo(v);
                    setError(null);
                  }}
                  style={input}
                >
                  <option value="MINORISTA">Minorista</option>
                  <option value="MAYORISTA">Mayorista</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ ...field, flex: "1 1 200px" }}>
                <label style={label}>Tipo de entrega *</label>
                <select
                  value={tipoEntrega}
                  onChange={(e) => {
                    setTipoEntrega(e.target.value);
                    setError(null);
                  }}
                  style={input}
                >
                  <option value="EN_TIENDA">En tienda</option>
                  <option value="DOMICILIO">Domicilio</option>
                </select>
              </div>
              <div style={{ ...field, flex: "1 1 200px" }}>
                <label style={label}>Bodega (salida de stock) *</label>
                <select
                  value={idBodega}
                  onChange={(e) => {
                    setIdBodega(e.target.value);
                    setError(null);
                  }}
                  style={input}
                >
                  <option value="">— Bodega —</option>
                  {bodegas.map((b) => (
                    <option key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre_bodega}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {tipoEntrega === "DOMICILIO" && (
              <div style={field}>
                <label style={label}>Dirección de entrega *</label>
                <input
                  value={direccionEntrega}
                  onChange={(e) => setDireccionEntrega(e.target.value)}
                  placeholder="Zona, calle, referencias…"
                  style={input}
                />
              </div>
            )}

            <div style={field}>
              <label style={label}>Fecha límite de pago (opcional)</label>
              <input
                type="date"
                value={fechaLimitePago}
                onChange={(e) => setFechaLimitePago(e.target.value)}
                style={input}
              />
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  marginBottom: "0.75rem",
                  color: "var(--text)",
                }}
              >
                Productos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {lineas.map((ln) => {
                  const pSel = ln.id_producto
                    ? productoPorId.get(Number(ln.id_producto))
                    : undefined;
                  return (
                    <div
                      key={ln.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 120px auto",
                        gap: "0.5rem",
                        alignItems: "end",
                      }}
                    >
                      <div style={field}>
                        <label style={label}>Producto</label>
                        <select
                          value={ln.id_producto}
                          onChange={(e) => onProductoChange(ln.key, e.target.value)}
                          style={input}
                        >
                          <option value="">— Producto —</option>
                          {productos
                            .filter((p) => p.estado_producto)
                            .map((p) => (
                              <option key={p.id_producto} value={p.id_producto}>
                                [{p.codigo_producto}] {p.nombre_producto}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div style={field}>
                        <label style={label}>Cantidad</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={ln.cantidad}
                          onChange={(e) =>
                            actualizarLinea(ln.key, { cantidad: e.target.value })
                          }
                          style={input}
                        />
                      </div>
                      <div style={field}>
                        <label style={label}>P. venta</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ln.precio_unitario_venta}
                          onChange={(e) =>
                            actualizarLinea(ln.key, {
                              precio_unitario_venta: e.target.value,
                            })
                          }
                          style={input}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLineas((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((x) => x.key !== ln.key)
                          )
                        }
                        disabled={lineas.length <= 1}
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--surface2)",
                          color: "var(--muted)",
                          cursor: lineas.length <= 1 ? "not-allowed" : "pointer",
                          height: 40,
                        }}
                        title="Quitar línea"
                      >
                        ✕
                      </button>
                      {pSel && (
                        <span
                          style={{
                            gridColumn: "1 / -1",
                            fontSize: "0.78rem",
                            color: "var(--muted)",
                          }}
                        >
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

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--text)" }}>
                Total: Q{totalBorrador.toFixed(2)}
              </span>
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
                {loadingSubmit ? "Guardando…" : "Registrar venta"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: "1rem",
                background: "rgba(248,81,73,.12)",
                border: "1px solid rgba(248,81,73,.3)",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                color: "var(--red)",
              }}
            >
              {error}
            </div>
          )}
          {okMsg && (
            <div
              style={{
                marginTop: "1rem",
                background: "rgba(63,185,80,.12)",
                border: "1px solid rgba(63,185,80,.35)",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                color: "var(--green)",
              }}
            >
              {okMsg}
            </div>
          )}
        </div>

        <div>
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontSize: "1.15rem",
              marginBottom: "1rem",
              color: accent,
            }}
          >
            Ventas recientes
          </h2>
          {loadingLista ? (
            <p style={{ color: "var(--muted)" }}>Cargando historial…</p>
          ) : (
            <div
              style={{
                overflowX: "auto",
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--surface)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                <thead>
                  <tr style={{ background: accent, color: "#fff" }}>
                    <th style={th}>#</th>
                    <th style={th}>Fecha</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Colaborador</th>
                    <th style={th}>Estado pago</th>
                    <th style={th}>Tipo</th>
                    <th style={{ ...th, textAlign: "right" }}>Total</th>
                    <th style={th}>Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v, i) => (
                    <tr
                      key={v.id_venta}
                      style={{
                        background: i % 2 === 0 ? "var(--surface2)" : "var(--surface)",
                        verticalAlign: "top",
                      }}
                    >
                      <td style={td}>{v.id_venta}</td>
                      <td style={td}>
                        {new Date(v.fecha_venta).toLocaleString("es-GT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>{v.nombre_cliente}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                          {v.correo_cliente}
                        </div>
                      </td>
                      <td style={td}>{v.nombre_colaborador ?? "—"}</td>
                      <td style={td}>{v.estado_venta}</td>
                      <td style={td}>{v.tipo_venta}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                        Q{Number(v.total).toFixed(2)}
                      </td>
                      <td style={{ ...td, fontSize: "0.82rem", maxWidth: 320 }}>
                        {(v.productos || []).map((pr) => (
                          <div key={pr.id_detalle} style={{ marginBottom: "0.35rem" }}>
                            <span style={{ color: "var(--text)" }}>
                              {pr.codigo_producto}
                            </span>{" "}
                            × {Number(pr.cantidad).toFixed(3)} @ Q
                            {Number(pr.precio_unitario_venta).toFixed(2)} → Q
                            {Number(pr.subtotal).toFixed(2)}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ventas.length === 0 && (
                <p style={{ padding: "1.25rem", color: "var(--muted)", margin: 0 }}>
                  Aún no hay ventas registradas.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const label: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.88rem",
  color: "var(--muted)",
};

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
