"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useBodegueroSession } from "@/hooks/useBodegueroSession";
import { Icon } from "@/components/Icon";

type Producto = {
  id_producto: number;
  nombre_producto: string;
  codigo_producto: string;
  unidad_medida: string;
};

type Presentacion = {
  id_presentacion: number;
  nombre_presentacion: string;
  factor_conversion: string;
};

type BodegaSimple = { id_bodega: number; nombre_bodega: string };

type Movimiento = {
  id_kardex: number;
  fecha_movimiento: string;
  tipo_movimiento: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: string;
  descripcion: string | null;
  motivo: string | null;
  nombre_producto: string;
  unidad_medida: string;
  nombre_presentacion: string | null;
  cantidad_presentacion: string | null;
};

type TabKey = "pedidos" | "entrada" | "salida" | "traslado";

const MOTIVO_LABEL: Record<string, string> = {
  MERMA: "Merma / daño",
  USO_INTERNO: "Uso interno",
  TRASLADO: "Traslado",
};

// ─── Tablero "en vivo" de pedidos (como ordenes en fast food) ─────────────────

type ProductoPedido = {
  id_detalle: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: string;
  unidad_medida: string;
  id_bodega: number | null;
  es_mi_bodega: boolean;
};

type Pedido = {
  id_orden: number;
  fecha_orden: string;
  estado: "CONFIRMADO" | "EN_PREPARACION" | "ENVIADO";
  notas: string | null;
  total: string;
  nombre_cliente: string;
  productos: ProductoPedido[];
};

const COLUMNAS_PEDIDOS: { estado: Pedido["estado"]; titulo: string; siguiente?: { estado: string; label: string } }[] = [
  { estado: "CONFIRMADO", titulo: "Nuevos", siguiente: { estado: "EN_PREPARACION", label: "Empezar a preparar" } },
  { estado: "EN_PREPARACION", titulo: "En preparación", siguiente: { estado: "ENVIADO", label: "Marcar enviado" } },
  { estado: "ENVIADO", titulo: "Enviados", siguiente: undefined },
];

const PEDIDOS_POLL_MS = 6000;

export default function BodegaPage() {
  const usuario = useBodegueroSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("pedidos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [avanzandoId, setAvanzandoId] = useState<number | null>(null);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegasDestino, setBodegasDestino] = useState<BodegaSimple[]>([]);
  const [nombreBodegaPropia, setNombreBodegaPropia] = useState<string>("");
  const [historial, setHistorial] = useState<Movimiento[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);

  const [idProducto, setIdProducto] = useState("");
  const [idPresentacion, setIdPresentacion] = useState(""); // "" = unidad base
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState<"MERMA" | "USO_INTERNO">("MERMA");
  const [idBodegaDestino, setIdBodegaDestino] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "ok" | "err" } | null>(null);

  const cargarHistorial = useCallback(() => {
    fetch("/api/bodega/historial")
      .then((r) => r.json())
      .then((d) => setHistorial(d.movimientos || []))
      .catch(() => {});
  }, []);

  const cargarPedidos = useCallback(() => {
    fetch("/api/bodega/pedidos")
      .then((r) => r.json())
      .then((d) => {
        if (d.pedidos) {
          setPedidos(d.pedidos);
          setPedidosError(null);
        } else if (d.error) {
          setPedidosError(d.error);
        }
      })
      .catch(() => setPedidosError("No se pudo cargar el tablero de pedidos"));
  }, []);

  // Tablero en vivo: se refresca solo mientras la pestana de Pedidos esta
  // activa, como una pantalla de ordenes en cocina.
  useEffect(() => {
    if (!usuario || tab !== "pedidos") return;
    cargarPedidos();
    const interval = setInterval(cargarPedidos, PEDIDOS_POLL_MS);
    return () => clearInterval(interval);
  }, [usuario, tab, cargarPedidos]);

  const avanzarPedido = async (idOrden: number, siguienteEstado: string) => {
    setAvanzandoId(idOrden);
    setPedidosError(null);
    try {
      const r = await fetch(`/api/ordenes/${idOrden}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: siguienteEstado }),
      });
      const d = await r.json();
      if (!r.ok) {
        setPedidosError(d.error || "No se pudo actualizar el pedido");
      } else {
        cargarPedidos();
      }
    } catch {
      setPedidosError("Error de conexión");
    } finally {
      setAvanzandoId(null);
    }
  };

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []))
      .catch(() => {});
    fetch("/api/bodegas/simple")
      .then((r) => r.json())
      .then((d) => {
        const todas: BodegaSimple[] = d.bodegas || [];
        setBodegasDestino(todas.filter((b) => b.id_bodega !== usuario.id_bodega));
        setNombreBodegaPropia(todas.find((b) => b.id_bodega === usuario.id_bodega)?.nombre_bodega || "");
      })
      .catch(() => {});
    cargarHistorial();
  }, [usuario, cargarHistorial]);

  useEffect(() => {
    setIdPresentacion("");
    if (!idProducto) {
      setPresentaciones([]);
      return;
    }
    fetch(`/api/presentaciones?id_producto=${idProducto}`)
      .then((r) => r.json())
      .then((d) => setPresentaciones(d.presentaciones || []))
      .catch(() => setPresentaciones([]));
  }, [idProducto]);

  const limpiarFormulario = () => {
    setIdProducto("");
    setIdPresentacion("");
    setCantidad("");
    setDescripcion("");
    setIdBodegaDestino("");
    setMotivo("MERMA");
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  };

  const enviar = async () => {
    setMensaje(null);
    if (!idProducto || !cantidad || Number(cantidad) <= 0) {
      setMensaje({ texto: "Selecciona un producto y una cantidad válida", tipo: "err" });
      return;
    }
    if (tab === "traslado" && !idBodegaDestino) {
      setMensaje({ texto: "Selecciona la bodega destino", tipo: "err" });
      return;
    }
    if (tab === "salida" && motivo === "USO_INTERNO" && !descripcion.trim()) {
      setMensaje({ texto: "Describe brevemente el uso interno", tipo: "err" });
      return;
    }

    setEnviando(true);
    try {
      let url = "";
      let body: Record<string, unknown> = {
        id_producto: Number(idProducto),
      };

      if (idPresentacion) {
        body.id_presentacion = Number(idPresentacion);
        body.cantidad_presentacion = Number(cantidad);
      } else {
        body.cantidad = Number(cantidad);
      }

      if (tab === "entrada") {
        url = "/api/inventario/entrada";
        body.tipo_ingreso = "UNIDADES";
        body.descripcion = descripcion || undefined;
      } else if (tab === "salida") {
        url = "/api/inventario/salida";
        body.motivo = motivo;
        body.descripcion = descripcion || undefined;
      } else {
        url = "/api/gestion-inventario/transferencia";
        body = {
          id_bodega_destino: Number(idBodegaDestino),
          id_producto: Number(idProducto),
          cantidad: idPresentacion
            ? Number(cantidad) *
              Number(presentaciones.find((p) => p.id_presentacion === Number(idPresentacion))?.factor_conversion || 1)
            : Number(cantidad),
          descripcion: descripcion || undefined,
        };
      }

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setMensaje({ texto: d.error || "No se pudo registrar el movimiento", tipo: "err" });
      } else {
        setMensaje({ texto: "Movimiento registrado ✓", tipo: "ok" });
        limpiarFormulario();
        cargarHistorial();
      }
    } catch {
      setMensaje({ texto: "Error de conexión", tipo: "err" });
    } finally {
      setEnviando(false);
    }
  };

  if (!usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div>
          <div style={s.title}>
            <Icon name="hand-truck" size={22} /> Panel de bodega
          </div>
          <div style={s.subtitle}>{usuario.nombre}</div>
        </div>
        <button type="button" style={s.logoutBtn} onClick={handleLogout}>
          <Icon name="logout" size={14} variant="light" /> Cerrar sesión
        </button>
      </header>

      <main style={s.main}>
        <div style={s.tabs}>
          {(["pedidos", "entrada", "salida", "traslado"] as TabKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setMensaje(null);
              }}
              style={{
                ...s.tabBtn,
                borderColor: tab === k ? "var(--accent2)" : "var(--border)",
                background: tab === k ? "rgba(34,197,94,.12)" : "var(--surface)",
                color: tab === k ? "var(--text)" : "var(--muted)",
              }}
            >
              {k === "pedidos" ? "Pedidos" : k === "entrada" ? "Entrada" : k === "salida" ? "Salida" : "Traslado"}
            </button>
          ))}
        </div>

        {tab === "pedidos" && (
          <div style={s.pedidosBoard}>
            {pedidosError && (
              <div style={{ ...s.msgBox, borderColor: "var(--red)", color: "var(--red)" }}>{pedidosError}</div>
            )}
            <div style={s.pedidosColumns}>
              {COLUMNAS_PEDIDOS.map((col) => {
                const items = pedidos.filter((p) => p.estado === col.estado);
                return (
                  <div key={col.estado} style={s.pedidosColumn}>
                    <div style={s.pedidosColumnHeader}>
                      {col.titulo} <span style={{ opacity: 0.6 }}>({items.length})</span>
                    </div>
                    <div style={s.pedidosColumnBody}>
                      {items.length === 0 && (
                        <div style={{ color: "var(--muted)", fontSize: "0.82rem", padding: "0.5rem" }}>
                          Sin pedidos aquí
                        </div>
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
                            {p.nombre_cliente}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "0.6rem" }}>
                            {p.productos
                              .filter((pr) => pr.es_mi_bodega)
                              .map((pr) => (
                                <div key={pr.id_detalle} style={{ fontSize: "0.85rem" }}>
                                  <strong>{Number(pr.cantidad).toLocaleString("es-GT")}</strong>{" "}
                                  {pr.unidad_medida} — {pr.nombre_producto}
                                </div>
                              ))}
                          </div>
                          {p.notas && (
                            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic", marginBottom: "0.6rem" }}>
                              &ldquo;{p.notas}&rdquo;
                            </div>
                          )}
                          {col.siguiente && (
                            <button
                              type="button"
                              onClick={() => avanzarPedido(p.id_orden, col.siguiente!.estado)}
                              disabled={avanzandoId === p.id_orden}
                              style={s.pedidoAdvanceBtn}
                            >
                              {avanzandoId === p.id_orden ? "Actualizando…" : col.siguiente.label}
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
        )}

        {tab !== "pedidos" && <div style={s.card}>
          <div style={s.field}>
            <label style={s.label}>Producto</label>
            <select style={s.input} value={idProducto} onChange={(e) => setIdProducto(e.target.value)}>
              <option value="">Selecciona un producto…</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.nombre_producto} ({p.codigo_producto})
                </option>
              ))}
            </select>
          </div>

          <div style={s.row}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Cantidad</label>
              <input
                style={s.input}
                type="number"
                min="0"
                step="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
              />
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Presentación</label>
              <select style={s.input} value={idPresentacion} onChange={(e) => setIdPresentacion(e.target.value)}>
                <option value="">
                  {productos.find((p) => p.id_producto === Number(idProducto))?.unidad_medida || "Unidad base"}
                </option>
                {presentaciones.map((pr) => (
                  <option key={pr.id_presentacion} value={pr.id_presentacion}>
                    {pr.nombre_presentacion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tab === "salida" && (
            <div style={s.field}>
              <label style={s.label}>Motivo</label>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                {(["MERMA", "USO_INTERNO"] as const).map((m) => (
                  <label
                    key={m}
                    style={{
                      ...s.radioPill,
                      borderColor: motivo === m ? "var(--accent2)" : "var(--border)",
                      background: motivo === m ? "rgba(34,197,94,.12)" : "var(--surface)",
                    }}
                  >
                    <input type="radio" checked={motivo === m} onChange={() => setMotivo(m)} />
                    {MOTIVO_LABEL[m]}
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === "traslado" && (
            <>
              <div style={s.field}>
                <label style={s.label}>Bodega origen</label>
                <input style={{ ...s.input, opacity: 0.75 }} value={nombreBodegaPropia || "Tu bodega"} disabled readOnly />
              </div>
              <div style={s.field}>
                <label style={s.label}>Bodega destino</label>
                <select style={s.input} value={idBodegaDestino} onChange={(e) => setIdBodegaDestino(e.target.value)}>
                  <option value="">Selecciona la bodega destino…</option>
                  {bodegasDestino.map((b) => (
                    <option key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre_bodega}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div style={s.field}>
            <label style={s.label}>
              Descripción {tab === "salida" && motivo === "USO_INTERNO" ? "*" : "(opcional)"}
            </label>
            <input
              style={s.input}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle breve del movimiento"
            />
          </div>

          {mensaje && (
            <div
              style={{
                ...s.msgBox,
                borderColor: mensaje.tipo === "ok" ? "var(--accent2)" : "var(--red)",
                color: mensaje.tipo === "ok" ? "var(--accent2)" : "var(--red)",
              }}
            >
              {mensaje.texto}
            </div>
          )}

          <button type="button" style={s.submitBtn} onClick={enviar} disabled={enviando}>
            {enviando ? "Guardando…" : "Registrar movimiento"}
          </button>
        </div>}

        {tab !== "pedidos" && (
          <div style={s.historial}>
            <div style={s.historialTitle}>Últimos movimientos de tu bodega</div>
            {historial.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Sin movimientos recientes</div>
            )}
            {historial.map((m) => (
              <div key={m.id_kardex} style={s.historialRow}>
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: m.tipo_movimiento === "SALIDA" ? "var(--red)" : "var(--accent2)",
                    }}
                  >
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
        )}
      </main>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)" },
  pedidosBoard: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  pedidosColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "0.85rem",
    alignItems: "start",
  },
  pedidosColumn: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    minHeight: 200,
  },
  pedidosColumnHeader: {
    padding: "0.75rem 1rem",
    fontWeight: 700,
    fontSize: "0.92rem",
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
  },
  pedidosColumnBody: {
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },
  pedidoCard: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.75rem 0.85rem",
  },
  pedidoCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "0.2rem",
  },
  pedidoAdvanceBtn: {
    width: "100%",
    padding: "0.55rem 0.7rem",
    borderRadius: 8,
    border: "none",
    background: "var(--accent2)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    background: "var(--sidebar-bg, #1E293B)",
    color: "#fff",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: "var(--font-head)",
    fontSize: "1.1rem",
    fontWeight: 700,
  },
  subtitle: { fontSize: "0.8rem", opacity: 0.75, marginTop: "0.15rem" },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.5rem 0.85rem",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.25)",
    background: "transparent",
    color: "#fff",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  main: { maxWidth: 480, margin: "0 auto", padding: "1.25rem" },
  tabs: { display: "flex", gap: "0.5rem", marginBottom: "1rem" },
  tabBtn: {
    flex: 1,
    padding: "0.6rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "1.1rem",
    boxShadow: "var(--shadow)",
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
  },
  row: { display: "flex", gap: "0.75rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  label: { fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" },
  input: {
    padding: "0.6rem 0.7rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: "0.9rem",
    background: "var(--surface)",
    color: "var(--text)",
  },
  radioPill: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: "0.82rem",
    cursor: "pointer",
    flex: 1,
  },
  msgBox: { padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid", fontSize: "0.85rem" },
  submitBtn: {
    padding: "0.75rem",
    borderRadius: 8,
    border: "none",
    background: "var(--accent2)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  historial: { marginTop: "1.25rem" },
  historialTitle: { fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.6rem" },
  historialRow: {
    padding: "0.6rem 0",
    borderBottom: "1px solid var(--border)",
    fontSize: "0.85rem",
  },
};
