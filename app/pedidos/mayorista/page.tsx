"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_USUARIO, postLoginPath } from "@/lib/roles";

// Tipos 

type Usuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

type Producto = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_mayoreo: string;
  unidad_medida: string;
  stock_total: number;
};

type Bodega = { id_bodega: number; nombre_bodega: string };

type LineaDetalle = {
  id_detalle: number;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
  cantidad: string;
  precio_unitario_venta: string;
  subtotal: string;
};

type Pedido = {
  id_venta: number;
  fecha_venta: string;
  estado_venta: string;
  tipo_entrega: string;
  direccion_entrega: string | null;
  total: string;
  fecha_limite_pago: string | null;
  nombre_colaborador: string | null;
  numero_factura: string | null;
  id_factura: number | null;
  productos: LineaDetalle[];
};

type Pagination = { total: number; page: number; limit: number; totalPages: number };

type LineaNueva = {
  key: string;
  id_producto: string;
  cantidad: string;
  precio_unitario_venta: string;
};

function nuevaLinea(): LineaNueva {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id_producto: "",
    cantidad: "",
    precio_unitario_venta: "",
  };
}

// Helpers de estilo

const ESTADO_META: Record<string, { label: string; bg: string; color: string }> = {
  PENDIENTE:  { label: "Pendiente",  bg: "rgba(232,160,69,.18)",  color: "var(--accent)" },
  CONFIRMADO: { label: "Confirmado", bg: "rgba(88,166,255,.15)",  color: "var(--blue)" },
  ENTREGADO:  { label: "Entregado",  bg: "rgba(63,185,80,.15)",   color: "var(--green)" },
  CANCELADO:  { label: "Cancelado",  bg: "rgba(248,81,73,.13)",   color: "var(--red)" },
};

function EstadoBadge({ estado }: { estado: string }) {
  const meta = ESTADO_META[estado] ?? { label: estado, bg: "var(--surface2)", color: "var(--muted)" };
  return (
    <span style={{
      display: "inline-block",
      padding: "0.2rem 0.65rem",
      borderRadius: 99,
      fontSize: "0.75rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: meta.bg,
      color: meta.color,
    }}>
      {meta.label}
    </span>
  );
}

// Componente principal 

export default function PedidosMayoristaPage() {
  const router = useRouter();

  // Sesión
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // Catálogo y bodegas (para el formulario de nuevo pedido)
  const [catalogoProductos, setCatalogoProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);

  // Lista de pedidos
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loadingLista, setLoadingLista] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroQ, setFiltroQ] = useState("");
  const [filtroPage, setFiltroPage] = useState(1);

  // Detalle expandido inline
  const [expandido, setExpandido] = useState<number | null>(null);

  // Modal nuevo pedido
  const [modalOpen, setModalOpen] = useState(false);
  const [idBodega, setIdBodega] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState("EN_TIENDA");
  const [direccion, setDireccion] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [lineas, setLineas] = useState<LineaNueva[]>([nuevaLinea()]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Confirmación cancelación
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  // Inicialización: verificar sesión 
  useEffect(() => {
    fetch("/api/sesion")
      .then((r) => r.json())
      .then((d) => {
        if (!d.usuario) { router.replace("/login"); return; }
        if (d.usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR_MAYOR) {
          router.replace(postLoginPath(d.usuario.tipo_usuario));
          return;
        }
        setUsuario(d.usuario);
      });
  }, [router]);

  // Cargar catálogo y bodegas una sola vez
  useEffect(() => {
    if (!usuario) return;
    fetch("/api/tienda/catalogo")
      .then((r) => r.json())
      .then((d) => setCatalogoProductos(d.productos || []));
    fetch("/api/bodegas")
      .then((r) => r.json())
      .then((d) => setBodegas(d.bodegas || []));
  }, [usuario]);

  // Cargar pedidos con filtros 
  const cargarPedidos = useCallback(async (overridePage?: number) => {
    setLoadingLista(true);
    const page = overridePage ?? filtroPage;
    const params = new URLSearchParams();
    if (filtroEstado) params.set("estado", filtroEstado);
    if (filtroDesde)  params.set("desde", filtroDesde);
    if (filtroHasta)  params.set("hasta", filtroHasta);
    if (filtroQ)      params.set("q", filtroQ);
    params.set("page", String(page));

    try {
      const r = await fetch(`/api/pedidos/mayorista?${params}`);
      const d = await r.json();
      if (r.ok) {
        setPedidos(d.pedidos || []);
        setPagination(d.pagination);
      }
    } finally {
      setLoadingLista(false);
    }
  }, [filtroEstado, filtroDesde, filtroHasta, filtroQ, filtroPage]);

  useEffect(() => {
    if (usuario) cargarPedidos();
  }, [usuario, cargarPedidos]);

  // Helpers 
  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const prodPorId = useMemo(() => {
    const m = new Map<number, Producto>();
    catalogoProductos.forEach((p) => m.set(p.id_producto, p));
    return m;
  }, [catalogoProductos]);

  const totalBorrador = useMemo(() => {
    return lineas.reduce((acc, ln) => {
      const q = Number(ln.cantidad);
      const p = Number(ln.precio_unitario_venta);
      if (q > 0 && p >= 0 && !isNaN(q) && !isNaN(p)) return acc + Math.round(q * p * 100) / 100;
      return acc;
    }, 0);
  }, [lineas]);

  // Filtros submit 
  function aplicarFiltros(e: React.FormEvent) {
    e.preventDefault();
    setFiltroPage(1);
    cargarPedidos(1);
  }

  function limpiarFiltros() {
    setFiltroEstado("");
    setFiltroDesde("");
    setFiltroHasta("");
    setFiltroQ("");
    setFiltroPage(1);
    // Forzar recarga con valores limpios
    setTimeout(() => cargarPedidos(1), 0);
  }

  // Crear pedido 
  async function handleCrearPedido() {
    setFormError("");
    const lineasValidas = lineas.filter(
      (ln) => ln.id_producto && ln.cantidad && Number(ln.cantidad) > 0
    );
    if (!idBodega) { setFormError("Selecciona una bodega"); return; }
    if (lineasValidas.length === 0) { setFormError("Agrega al menos un producto"); return; }
    if (tipoEntrega === "DOMICILIO" && !direccion.trim()) {
      setFormError("La dirección de entrega es requerida"); return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch("/api/pedidos/mayorista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_bodega: Number(idBodega),
          tipo_entrega: tipoEntrega,
          direccion_entrega: tipoEntrega === "DOMICILIO" ? direccion.trim() : undefined,
          fecha_limite_pago: fechaLimite || undefined,
          lineas: lineasValidas.map((ln) => ({
            id_producto: Number(ln.id_producto),
            cantidad: Number(ln.cantidad),
            precio_unitario_venta: Number(ln.precio_unitario_venta),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Error al crear el pedido");
      } else {
        setModalOpen(false);
        setLineas([nuevaLinea()]);
        setIdBodega("");
        setTipoEntrega("EN_TIENDA");
        setDireccion("");
        setFechaLimite("");
        showToast(`Pedido #${data.id_venta} creado — Total: Q${Number(data.total).toFixed(2)}`, "ok");
        cargarPedidos(1);
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  // Cancelar pedido 
  async function handleCancelar(id: number) {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/pedidos/mayorista/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.mensaje, "ok");
        cargarPedidos();
      } else {
        showToast(data.error || "Error al cancelar", "err");
      }
    } finally {
      setCancelLoading(false);
      setCancelId(null);
    }
  }

  // Líneas del formulario 
  function onProductoChange(key: string, idStr: string) {
    const p = prodPorId.get(Number(idStr));
    setLineas((prev) =>
      prev.map((ln) =>
        ln.key === key
          ? { ...ln, id_producto: idStr, precio_unitario_venta: p ? String(p.precio_mayoreo) : "" }
          : ln
      )
    );
  }

  function updateLinea(key: string, patch: Partial<LineaNueva>) {
    setLineas((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
  }

  if (!usuario) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--muted)", fontFamily: "var(--font-body)" }}>
        Cargando…
      </div>
    );
  }

  // Render 
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)" }}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <div style={s.headerTop}>
            <span style={s.logoIcon}>🏪</span>
            <span style={s.logoText}>Tienda San Miguel</span>
            <span style={s.pill}>Mayorista</span>
          </div>
          <p style={s.headerSub}>Gestión de pedidos · {usuario.nombre}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { setModalOpen(true); setFormError(""); }}
            style={s.btnPrimary}
          >
            + Nuevo pedido
          </button>
          <button
            type="button"
            onClick={() => router.push("/mayoreo")}
            style={s.btnGhost}
          >
            Ver catálogo
          </button>
          <button
            type="button"
            onClick={async () => { await fetch("/api/logout", { method: "POST" }); router.replace("/login"); }}
            style={s.btnGhost}
          >
            Salir
          </button>
        </div>
      </header>

      <main style={s.main}>

        {/* ── Panel de filtros ── */}
        <form onSubmit={aplicarFiltros} style={s.filterBar}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Estado</label>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={s.filterInput}>
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Desde</label>
            <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} style={s.filterInput} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Hasta</label>
            <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} style={s.filterInput} />
          </div>
          <div style={{ ...s.filterGroup, flex: "2 1 180px" }}>
            <label style={s.filterLabel}>Producto / código</label>
            <input
              type="text"
              value={filtroQ}
              onChange={(e) => setFiltroQ(e.target.value)}
              placeholder="Buscar en mis pedidos…"
              style={s.filterInput}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", paddingBottom: "0.05rem" }}>
            <button type="submit" style={s.btnFilter}>Filtrar</button>
            <button type="button" onClick={limpiarFiltros} style={s.btnGhost}>Limpiar</button>
          </div>
        </form>

        {/* ── Resumen ── */}
        <div style={s.summaryRow}>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {loadingLista ? "Cargando…" : `${pagination.total} pedido${pagination.total !== 1 ? "s" : ""} encontrado${pagination.total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* ── Tabla de pedidos ── */}
        {loadingLista ? (
          <div style={s.emptyBox}>
            <span style={{ fontSize: "2rem" }}>⏳</span>
            <p style={{ color: "var(--muted)" }}>Cargando pedidos…</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div style={s.emptyBox}>
            <span style={{ fontSize: "2.5rem" }}>📋</span>
            <p style={{ color: "var(--text)", fontWeight: 600, marginTop: "0.5rem" }}>Sin pedidos</p>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem", maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
              No encontramos pedidos con los filtros seleccionados. Crea tu primer pedido mayorista con el botón de arriba.
            </p>
          </div>
        ) : (
          <>
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["#", "Fecha", "Estado", "Entrega", "Total", "Factura", "Límite pago", "Acciones"].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <>
                      <tr
                        key={p.id_venta}
                        style={{ ...s.tr, cursor: "pointer" }}
                        onClick={() => setExpandido(expandido === p.id_venta ? null : p.id_venta)}
                      >
                        <td style={s.td}>
                          <span style={{ fontWeight: 600, color: "var(--accent)" }}>#{p.id_venta}</span>
                        </td>
                        <td style={s.td}>
                          {new Date(p.fecha_venta).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td style={s.td}><EstadoBadge estado={p.estado_venta} /></td>
                        <td style={s.td}>
                          <span style={{ fontSize: "0.82rem" }}>
                            {p.tipo_entrega === "EN_TIENDA" ? "🏪 En tienda" : "🚚 Domicilio"}
                          </span>
                          {p.direccion_entrega && (
                            <div style={{ fontSize: "0.74rem", color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.direccion_entrega}
                            </div>
                          )}
                        </td>
                        <td style={{ ...s.td, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          Q{Number(p.total).toFixed(2)}
                        </td>
                        <td style={s.td}>
                          {p.numero_factura
                            ? <span style={{ fontSize: "0.8rem", color: "var(--green)" }}>{p.numero_factura}</span>
                            : <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>—</span>
                          }
                        </td>
                        <td style={{ ...s.td, color: "var(--muted)", fontSize: "0.82rem" }}>
                          {p.fecha_limite_pago
                            ? new Date(p.fecha_limite_pago).toLocaleDateString("es-GT")
                            : "—"}
                        </td>
                        <td style={s.td} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              type="button"
                              onClick={() => setExpandido(expandido === p.id_venta ? null : p.id_venta)}
                              style={s.btnIconGhost}
                              title="Ver detalle"
                            >
                              {expandido === p.id_venta ? "▲" : "▼"}
                            </button>
                            {p.estado_venta === "PENDIENTE" && (
                              <button
                                type="button"
                                onClick={() => setCancelId(p.id_venta)}
                                style={{ ...s.btnIconGhost, color: "var(--red)", borderColor: "rgba(248,81,73,.3)" }}
                                title="Cancelar pedido"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Fila expandida con detalle de productos */}
                      {expandido === p.id_venta && (
                        <tr key={`det-${p.id_venta}`} style={{ background: "var(--surface2)" }}>
                          <td colSpan={8} style={{ padding: "0.75rem 1.25rem 1rem" }}>
                            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                              Detalle de productos
                            </p>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                              <thead>
                                <tr style={{ color: "var(--muted)" }}>
                                  <th style={{ ...s.th, background: "none", fontWeight: 600 }}>Código</th>
                                  <th style={{ ...s.th, background: "none", fontWeight: 600 }}>Producto</th>
                                  <th style={{ ...s.th, background: "none", fontWeight: 600, textAlign: "right" }}>Cant.</th>
                                  <th style={{ ...s.th, background: "none", fontWeight: 600, textAlign: "right" }}>P. unit.</th>
                                  <th style={{ ...s.th, background: "none", fontWeight: 600, textAlign: "right" }}>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.productos.map((pr) => (
                                  <tr key={pr.id_detalle} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ ...s.td, fontSize: "0.8rem", padding: "0.4rem 0.85rem" }}>
                                      <code style={{ color: "var(--accent)", fontSize: "0.78rem" }}>{pr.codigo_producto}</code>
                                    </td>
                                    <td style={{ ...s.td, padding: "0.4rem 0.85rem" }}>{pr.nombre_producto}</td>
                                    <td style={{ ...s.td, textAlign: "right", padding: "0.4rem 0.85rem", fontVariantNumeric: "tabular-nums" }}>
                                      {Number(pr.cantidad).toFixed(3)} {pr.unidad_medida}
                                    </td>
                                    <td style={{ ...s.td, textAlign: "right", padding: "0.4rem 0.85rem", fontVariantNumeric: "tabular-nums" }}>
                                      Q{Number(pr.precio_unitario_venta).toFixed(2)}
                                    </td>
                                    <td style={{ ...s.td, textAlign: "right", padding: "0.4rem 0.85rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                      Q{Number(pr.subtotal).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={4} style={{ ...s.td, textAlign: "right", fontWeight: 700, padding: "0.5rem 0.85rem", borderTop: "2px solid var(--border)" }}>
                                    Total
                                  </td>
                                  <td style={{ ...s.td, textAlign: "right", fontWeight: 700, color: "var(--accent)", padding: "0.5rem 0.85rem", borderTop: "2px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>
                                    Q{Number(p.total).toFixed(2)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {p.nombre_colaborador && (
                              <p style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                                Atendido por: <strong style={{ color: "var(--text)" }}>{p.nombre_colaborador}</strong>
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination.totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={filtroPage <= 1}
                  onClick={() => { const p = filtroPage - 1; setFiltroPage(p); cargarPedidos(p); }}
                  style={{ ...s.btnGhost, opacity: filtroPage <= 1 ? 0.4 : 1 }}
                >
                  ‹ Anterior
                </button>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  Página {filtroPage} de {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={filtroPage >= pagination.totalPages}
                  onClick={() => { const p = filtroPage + 1; setFiltroPage(p); cargarPedidos(p); }}
                  style={{ ...s.btnGhost, opacity: filtroPage >= pagination.totalPages ? 0.4 : 1 }}
                >
                  Siguiente ›
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Modal: Nuevo pedido ── */}
      {modalOpen && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo pedido mayorista</h2>
              <button type="button" onClick={() => setModalOpen(false)} style={s.closeBtn}>✕</button>
            </div>

            <div style={{ ...s.modalBody, maxHeight: "60vh", overflowY: "auto" }}>
              {/* Bodega */}
              <div style={s.field}>
                <label style={s.label}>Bodega *</label>
                <select value={idBodega} onChange={(e) => { setIdBodega(e.target.value); setFormError(""); }} style={s.input}>
                  <option value="">— Selecciona una bodega —</option>
                  {bodegas.map((b) => (
                    <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>
                  ))}
                </select>
              </div>

              {/* Tipo entrega */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ ...s.field, flex: "1 1 180px" }}>
                  <label style={s.label}>Tipo de entrega *</label>
                  <select value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)} style={s.input}>
                    <option value="EN_TIENDA">En tienda</option>
                    <option value="DOMICILIO">Domicilio</option>
                  </select>
                </div>
                <div style={{ ...s.field, flex: "1 1 180px" }}>
                  <label style={s.label}>Límite de pago (opcional)</label>
                  <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} style={s.input} />
                </div>
              </div>

              {tipoEntrega === "DOMICILIO" && (
                <div style={s.field}>
                  <label style={s.label}>Dirección de entrega *</label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Zona, calle, referencias…"
                    style={s.input}
                  />
                </div>
              )}

              {/* Líneas de productos */}
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)", marginBottom: "0.6rem" }}>
                  Productos del pedido
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {lineas.map((ln) => {
                    const pSel = prodPorId.get(Number(ln.id_producto));
                    return (
                      <div key={ln.key} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px auto", gap: "0.5rem", alignItems: "end" }}>
                        <div style={s.field}>
                          <label style={s.label}>Producto</label>
                          <select value={ln.id_producto} onChange={(e) => onProductoChange(ln.key, e.target.value)} style={s.input}>
                            <option value="">— Producto —</option>
                            {catalogoProductos.map((p) => (
                              <option key={p.id_producto} value={p.id_producto}>
                                [{p.codigo_producto}] {p.nombre_producto}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={s.field}>
                          <label style={s.label}>Cantidad</label>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={ln.cantidad}
                            onChange={(e) => updateLinea(ln.key, { cantidad: e.target.value })}
                            style={s.input}
                          />
                        </div>
                        <div style={s.field}>
                          <label style={s.label}>P. venta</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ln.precio_unitario_venta}
                            onChange={(e) => updateLinea(ln.key, { precio_unitario_venta: e.target.value })}
                            style={s.input}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={lineas.length <= 1}
                          onClick={() => setLineas((prev) => prev.length <= 1 ? prev : prev.filter((x) => x.key !== ln.key))}
                          style={{ ...s.btnIconGhost, height: 38, opacity: lineas.length <= 1 ? 0.35 : 1 }}
                        >✕</button>
                        {pSel && (
                          <span style={{ gridColumn: "1 / -1", fontSize: "0.74rem", color: "var(--muted)" }}>
                            Stock disponible: <strong style={{ color: "var(--text)" }}>{pSel.stock_total} {pSel.unidad_medida}</strong>
                            {" · "}P. mayoreo sugerido: <strong style={{ color: "var(--accent)" }}>Q{Number(pSel.precio_mayoreo).toFixed(2)}</strong>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setLineas((p) => [...p, nuevaLinea()])}
                  style={{ ...s.btnGhost, marginTop: "0.6rem", fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}
                >
                  + Agregar producto
                </button>
              </div>

              {/* Total */}
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--border)", marginTop: "0.25rem" }}>
                <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)" }}>
                  Total estimado: <span style={{ color: "var(--accent)" }}>Q{totalBorrador.toFixed(2)}</span>
                </span>
              </div>

              {formError && (
                <div style={s.errorBox}>{formError}</div>
              )}
            </div>

            <div style={s.modalFooter}>
              <button type="button" onClick={() => setModalOpen(false)} style={s.btnGhost} disabled={submitLoading}>
                Cancelar
              </button>
              <button type="button" onClick={handleCrearPedido} style={s.btnPrimary} disabled={submitLoading}>
                {submitLoading ? "Enviando…" : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar cancelación ── */}
      {cancelId !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>¿Cancelar pedido #{cancelId}?</h2>
            </div>
            <div style={s.modalBody}>
              <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                Solo se pueden cancelar pedidos en estado <strong style={{ color: "var(--accent)" }}>Pendiente</strong>.
                El stock será devuelto automáticamente a bodega.
              </p>
            </div>
            <div style={s.modalFooter}>
              <button type="button" onClick={() => setCancelId(null)} style={s.btnGhost} disabled={cancelLoading}>
                No cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCancelar(cancelId)}
                style={{ ...s.btnPrimary, background: "var(--red)" }}
                disabled={cancelLoading}
              >
                {cancelLoading ? "Cancelando…" : "Sí, cancelar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.tipo === "ok" ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)",
          borderColor: toast.tipo === "ok" ? "rgba(63,185,80,.4)" : "rgba(248,81,73,.4)",
          color: toast.tipo === "ok" ? "var(--green)" : "var(--red)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// Estilos 

const s: Record<string, React.CSSProperties> = {
  header: {
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    padding: "1.25rem 2rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerTop: { display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.2rem" },
  logoIcon: { fontSize: "1.4rem" },
  logoText: {
    fontFamily: "var(--font-head)",
    fontSize: "1.2rem",
    fontWeight: 800,
    color: "var(--accent)",
  },
  pill: {
    background: "rgba(88,166,255,.15)",
    color: "var(--blue)",
    border: "1px solid rgba(88,166,255,.25)",
    borderRadius: 99,
    padding: "0.1rem 0.55rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  headerSub: { color: "var(--muted)", fontSize: "0.82rem", margin: 0 },
  main: { maxWidth: 1200, margin: "0 auto", padding: "1.75rem 2rem 4rem" },

  // Filtros
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    alignItems: "flex-end",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1rem 1.25rem",
    marginBottom: "1.25rem",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "0.3rem", flex: "1 1 120px" },
  filterLabel: { fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" },
  filterInput: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 7,
    padding: "0.5rem 0.75rem",
    color: "var(--text)",
    fontSize: "0.88rem",
    outline: "none",
    width: "100%",
  },
  btnFilter: {
    background: "var(--accent)",
    color: "#0d1117",
    border: "none",
    borderRadius: 8,
    padding: "0.5rem 1.1rem",
    fontWeight: 700,
    fontSize: "0.85rem",
    cursor: "pointer",
    fontFamily: "var(--font-head)",
    whiteSpace: "nowrap" as const,
  },

  summaryRow: { marginBottom: "0.75rem" },

  // Tabla
  tableWrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    background: "var(--surface2)",
    color: "var(--muted)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    padding: "0.7rem 0.85rem",
    textAlign: "left" as const,
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap" as const,
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "0.7rem 0.85rem", color: "var(--text)", fontSize: "0.88rem", verticalAlign: "middle" as const },

  // Empty
  emptyBox: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "0.35rem",
    padding: "4rem 2rem",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
  },

  // Botones
  btnPrimary: {
    background: "var(--accent)",
    color: "#0d1117",
    border: "none",
    borderRadius: 8,
    padding: "0.6rem 1.15rem",
    fontFamily: "var(--font-head)",
    fontSize: "0.88rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.5rem 0.9rem",
    color: "var(--muted)",
    fontSize: "0.85rem",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  btnIconGhost: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.55rem",
    color: "var(--muted)",
    fontSize: "0.8rem",
    cursor: "pointer",
  },

  // Modal
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,.65)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: "1rem",
  },
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    width: "100%",
    maxWidth: 660,
    boxShadow: "var(--shadow)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.2rem 1.5rem",
    borderBottom: "1px solid var(--border)",
  },
  modalTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontSize: "1rem",
    cursor: "pointer",
    padding: "0.2rem 0.4rem",
  },
  modalBody: {
    padding: "1.25rem 1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.9rem",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid var(--border)",
  },

  // Form
  field: { display: "flex", flexDirection: "column" as const, gap: "0.3rem" },
  label: { fontWeight: 600, fontSize: "0.82rem", color: "var(--muted)" },
  input: {
    padding: "0.55rem 0.75rem",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: "0.9rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  errorBox: {
    background: "rgba(248,81,73,.12)",
    border: "1px solid rgba(248,81,73,.3)",
    borderRadius: 8,
    padding: "0.65rem 1rem",
    color: "var(--red)",
    fontSize: "0.85rem",
  },

  // Toast
  toast: {
    position: "fixed" as const,
    bottom: "2rem",
    right: "2rem",
    padding: "0.85rem 1.25rem",
    borderRadius: "var(--radius)",
    border: "1px solid",
    fontSize: "0.88rem",
    fontWeight: 500,
    zIndex: 300,
    backdropFilter: "blur(8px)",
    boxShadow: "var(--shadow)",
    maxWidth: 400,
  },
};