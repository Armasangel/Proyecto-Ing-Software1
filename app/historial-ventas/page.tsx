"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { HISTORIAL_VENTAS_DEFAULT_LIMIT } from "@/lib/historial-ventas";
import { TIPOS_USUARIO } from "@/lib/roles";

type LineaHistorial = {
  codigo_producto: string | null;
  nombre_producto: string | null;
  id_producto: number;
  cantidad: string | number;
  subtotal: string | number;
};

type VentaHistorial = {
  id_venta: number;
  fecha_venta: string;
  estado_venta: string;
  tipo_venta: string;
  tipo_entrega: string;
  enlinea: boolean;
  total: string | number;
  nombre_cliente: string;
  correo_cliente: string;
  nombre_colaborador: string | null;
  productos: LineaHistorial[];
};

type Pagination = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  maxLimit: number;
};

type ProductoOpt = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
};

type ClienteOpt = {
  id_usuario: number;
  nombre: string;
  correo: string;
};

type ProveedorOpt = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
};

const PERIODOS: { value: string; label: string }[] = [
  { value: "", label: "Todo" },
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

const ACCENT = "#2d6a4f";
const ACCENT_SOFT = "rgba(45, 106, 79, 0.35)";

function num(v: string | number | unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return 0;
}

function buildHistorialParams(opts: {
  q: string;
  periodo: string;
  idProducto: number | null;
  idCliente: number | null;
  idProveedor: number | null;
  minTotal: number | null;
  maxTotal: number | null;
  /** Si true, no envía min/max (p. ej. cambio de periodo/producto para no arrastrar el rango anterior). */
  skipAmountFilter?: boolean;
  limit: number;
  offset: number;
  metaTotales: boolean;
}): string {
  const sp = new URLSearchParams();
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  if (opts.periodo) sp.set("periodo", opts.periodo);
  if (opts.idProducto != null) sp.set("id_producto", String(opts.idProducto));
  if (opts.idCliente != null) sp.set("id_cliente", String(opts.idCliente));
  if (opts.idProveedor != null) sp.set("id_proveedor", String(opts.idProveedor));
  if (!opts.skipAmountFilter) {
    if (opts.minTotal != null) sp.set("min_total", String(opts.minTotal));
    if (opts.maxTotal != null) sp.set("max_total", String(opts.maxTotal));
  }
  sp.set("limit", String(opts.limit));
  sp.set("offset", String(opts.offset));
  if (opts.metaTotales) sp.set("meta_totales", "1");
  return sp.toString();
}

export default function HistorialVentasPage() {
  const router = useRouter();
  const usuario = useStaffSession();

  const [ventas, setVentas] = useState<VentaHistorial[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [panelFiltros, setPanelFiltros] = useState(false);

  const [periodo, setPeriodo] = useState("");
  const [idProducto, setIdProducto] = useState<number | null>(null);
  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [idProveedor, setIdProveedor] = useState<number | null>(null);
  const [minTotal, setMinTotal] = useState<number | null>(null);
  const [maxTotal, setMaxTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  const [productosCat, setProductosCat] = useState<ProductoOpt[]>([]);
  const [clientesCat, setClientesCat] = useState<ClienteOpt[]>([]);
  const [proveedoresCat, setProveedoresCat] = useState<ProveedorOpt[]>([]);

  const [picker, setPicker] = useState<null | "producto" | "cliente" | "proveedor">(null);
  const [pickerBusqueda, setPickerBusqueda] = useState("");

  const prevStructuralRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) return;
    Promise.all([
      fetch("/api/productos").then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/proveedores").then((r) => r.json()),
    ])
      .then(([dp, dc, dpr]) => {
        setProductosCat(dp.productos || []);
        setClientesCat(dc.clientes || []);
        setProveedoresCat(dpr.proveedores || []);
      })
      .catch(() => {});
  }, [usuario]);

  const structuralKey = useMemo(
    () =>
      `${debouncedQ}|${periodo}|${idProducto ?? ""}|${idCliente ?? ""}|${idProveedor ?? ""}`,
    [debouncedQ, periodo, idProducto, idCliente, idProveedor]
  );

  const fetchHistorial = useCallback(
    async (opts: {
      offset: number;
      includeMeta: boolean;
      skipAmountFilter?: boolean;
    }) => {
      const params = buildHistorialParams({
        q: debouncedQ,
        periodo,
        idProducto,
        idCliente,
        idProveedor,
        minTotal,
        maxTotal,
        skipAmountFilter: opts.skipAmountFilter,
        limit: HISTORIAL_VENTAS_DEFAULT_LIMIT,
        offset: opts.offset,
        metaTotales: opts.includeMeta,
      });
      const res = await fetch(`/api/historial-ventas?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cargar historial");
      }
      return data as {
        ventas: VentaHistorial[];
        pagination: Pagination;
        totales?: { min_total: string | number; max_total: string | number };
      };
    },
    [
      debouncedQ,
      periodo,
      idProducto,
      idCliente,
      idProveedor,
      minTotal,
      maxTotal,
    ]
  );

  useEffect(() => {
    if (!usuario) return;
    if (usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
      router.replace("/dashboard");
      return;
    }

    const structuralChanged = prevStructuralRef.current !== structuralKey;
    if (structuralChanged && offset !== 0) {
      setOffset(0);
      return;
    }
    if (structuralChanged) {
      prevStructuralRef.current = structuralKey;
    }

    let cancelled = false;
    setCargando(true);
    setError("");

    const includeMeta = structuralChanged;
    const fetchOffset = offset;

    fetchHistorial({
      offset: fetchOffset,
      includeMeta,
      skipAmountFilter: structuralChanged,
    })
      .then((data) => {
        if (cancelled) return;
        const rows = data.ventas || [];
        if (fetchOffset === 0) {
          setVentas(rows);
        } else {
          setVentas((prev) => {
            const seen = new Set(prev.map((v) => v.id_venta));
            const extra = rows.filter((v) => !seen.has(v.id_venta));
            return [...prev, ...extra];
          });
        }
        setPagination(data.pagination);
        if (data.totales && structuralChanged) {
          const mn = num(data.totales.min_total);
          const mx = num(data.totales.max_total);
          setMinTotal(mn);
          setMaxTotal(mx >= mn ? mx : mn);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Error");
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usuario, router, structuralKey, offset, minTotal, maxTotal, fetchHistorial]);

  const sliderMinBound = 0;
  const rangosMontosListos = minTotal != null && maxTotal != null;
  const sliderMaxBound = useMemo(() => {
    if (!rangosMontosListos) return 1;
    const hi = maxTotal as number;
    const lo = minTotal as number;
    if (hi > lo) return Math.ceil(hi);
    return Math.max(1, Math.ceil(hi));
  }, [rangosMontosListos, minTotal, maxTotal]);

  const onMinSlider = (v: number) => {
    setOffset(0);
    const hi = maxTotal ?? sliderMaxBound;
    setMinTotal(Math.min(v, hi));
  };

  const onMaxSlider = (v: number) => {
    setOffset(0);
    const lo = minTotal ?? 0;
    setMaxTotal(Math.max(v, lo));
  };

  const nombreProductoSel = productosCat.find((p) => p.id_producto === idProducto);
  const nombreClienteSel = clientesCat.find((c) => c.id_usuario === idCliente);
  const nombreProveedorSel = proveedoresCat.find((p) => p.id_proveedor === idProveedor);

  const productosPickerFiltrados = useMemo(() => {
    const q = pickerBusqueda.trim().toLowerCase();
    if (!q) return productosCat;
    return productosCat.filter(
      (p) =>
        p.nombre_producto.toLowerCase().includes(q) ||
        p.codigo_producto.toLowerCase().includes(q)
    );
  }, [productosCat, pickerBusqueda]);

  const clientesPickerFiltrados = useMemo(() => {
    const q = pickerBusqueda.trim().toLowerCase();
    if (!q) return clientesCat;
    return clientesCat.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.correo.toLowerCase().includes(q)
    );
  }, [clientesCat, pickerBusqueda]);

  const proveedoresPickerFiltrados = useMemo(() => {
    const q = pickerBusqueda.trim().toLowerCase();
    if (!q) return proveedoresCat;
    return proveedoresCat.filter(
      (p) =>
        p.nombre_proveedor.toLowerCase().includes(q) ||
        p.nit_proveedor.toLowerCase().includes(q)
    );
  }, [proveedoresCat, pickerBusqueda]);

  if (!usuario) {
    return (
      <p style={{ padding: "2rem", color: "var(--muted)", fontFamily: "var(--font-body)" }}>
        Cargando…
      </p>
    );
  }

  if (usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
    return null;
  }

  const resumenLineas = (v: VentaHistorial) => {
    const arr = Array.isArray(v.productos) ? v.productos : [];
    if (arr.length === 0) return "—";
    if (arr.length === 1) {
      return `${arr[0].nombre_producto ?? arr[0].codigo_producto ?? "Producto"}`;
    }
    return `${arr.length} productos`;
  };

  return (
    <StaffShell
      usuario={usuario}
      title="Historial de ventas"
      subtitle="Consulta y filtra todas las ventas registradas"
    >
      <div style={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar por cliente, producto, proveedor, # venta…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={s.searchInput}
        />
        <button
          type="button"
          onClick={() => setPanelFiltros((x) => !x)}
          style={{
            ...s.btnOutline,
            borderColor: panelFiltros ? ACCENT : "var(--border)",
            color: panelFiltros ? ACCENT : "var(--muted)",
          }}
        >
          {panelFiltros ? "Ocultar filtros" : "Filtros"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>{error}</p>
      )}

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>Fecha</th>
              <th style={s.th}>Cliente</th>
              <th style={s.th}>Resumen</th>
              <th style={{ ...s.th, textAlign: "right" }}>Total</th>
              <th style={s.th}>Estado</th>
              <th style={s.th}>Tipo</th>
              <th style={s.th}>Colaborador</th>
            </tr>
          </thead>
          <tbody>
            {cargando && ventas.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...s.td, textAlign: "center", color: "var(--muted)" }}>
                  Cargando…
                </td>
              </tr>
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...s.td, textAlign: "center", color: "var(--muted)" }}>
                  No hay ventas con los filtros actuales.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr key={v.id_venta} style={s.tr}>
                  <td style={s.td}>
                    <code style={s.code}>{v.id_venta}</code>
                  </td>
                  <td style={{ ...s.td, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {new Date(v.fecha_venta).toLocaleString("es-GT", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 500 }}>{v.nombre_cliente}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{v.correo_cliente}</div>
                  </td>
                  <td style={{ ...s.td, maxWidth: 220 }}>{resumenLineas(v)}</td>
                  <td style={{ ...s.td, textAlign: "right", fontWeight: 600 }}>Q{num(v.total).toFixed(2)}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badgeEstado, ...estadoStyle(v.estado_venta) }}>{v.estado_venta}</span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{v.tipo_venta}</span>
                    {v.enlinea ? (
                      <span style={{ ...s.tag, marginLeft: 6 }}>En línea</span>
                    ) : null}
                  </td>
                  <td style={{ ...s.td, color: "var(--muted)" }}>{v.nombre_colaborador ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        {pagination?.hasMore && (
          <button
            type="button"
            disabled={cargando || pagination.nextOffset == null}
            onClick={() => pagination.nextOffset != null && setOffset(pagination.nextOffset)}
            style={s.btnPrimary}
          >
            Cargar más
          </button>
        )}
        {cargando && ventas.length > 0 && (
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Actualizando…</span>
        )}
      </div>

      {/* Panel lateral filtros */}
      {panelFiltros && (
        <>
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => setPanelFiltros(false)}
            style={s.drawerBackdrop}
          />
          <aside style={s.drawer}>
            <div style={s.drawerHeader}>
              <h2 style={s.drawerTitle}>Filtros</h2>
              <button type="button" onClick={() => setPanelFiltros(false)} style={s.closeBtn}>
                ✕
              </button>
            </div>
            <div style={s.drawerBody}>
              <label style={s.label}>Periodo</label>
              <div style={s.btnRow}>
                {PERIODOS.map((p) => (
                  <button
                    key={p.value || "all"}
                    type="button"
                    onClick={() => setPeriodo(p.value)}
                    style={{
                      ...s.chip,
                      background: periodo === p.value ? ACCENT_SOFT : "var(--surface2)",
                      borderColor: periodo === p.value ? ACCENT : "var(--border)",
                      color: periodo === p.value ? "#b7e4c7" : "var(--text)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label style={s.label}>Total venta (Q)</label>
              {!rangosMontosListos ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
                  Cargando rango de totales…
                </p>
              ) : (
                <>
                  <div style={s.rangeRow}>
                    <span style={s.rangeVal}>Min: Q{(minTotal ?? 0).toFixed(2)}</span>
                    <span style={s.rangeVal}>Max: Q{(maxTotal ?? sliderMaxBound).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={sliderMinBound}
                    max={sliderMaxBound}
                    step={1}
                    value={Math.min(Math.max(minTotal ?? 0, sliderMinBound), sliderMaxBound)}
                    onChange={(e) => onMinSlider(Number(e.target.value))}
                    style={{ width: "100%", accentColor: ACCENT }}
                  />
                  <input
                    type="range"
                    min={sliderMinBound}
                    max={sliderMaxBound}
                    step={1}
                    value={Math.min(Math.max(maxTotal ?? sliderMaxBound, sliderMinBound), sliderMaxBound)}
                    onChange={(e) => onMaxSlider(Number(e.target.value))}
                    style={{ width: "100%", accentColor: ACCENT, marginTop: 8 }}
                  />
                </>
              )}

              <label style={s.label}>Producto</label>
              <button type="button" onClick={() => { setPicker("producto"); setPickerBusqueda(""); }} style={s.btnPicker}>
                {idProducto == null
                  ? "Todos los productos"
                  : `${nombreProductoSel?.codigo_producto ?? idProducto} — ${nombreProductoSel?.nombre_producto ?? ""}`}
              </button>
              {idProducto != null && (
                <button type="button" onClick={() => setIdProducto(null)} style={s.linkBtn}>
                  Quitar filtro
                </button>
              )}

              <label style={s.label}>Cliente</label>
              <button type="button" onClick={() => { setPicker("cliente"); setPickerBusqueda(""); }} style={s.btnPicker}>
                {idCliente == null
                  ? "Todos los clientes"
                  : `${nombreClienteSel?.nombre ?? idCliente}`}
              </button>
              {idCliente != null && (
                <button type="button" onClick={() => setIdCliente(null)} style={s.linkBtn}>
                  Quitar filtro
                </button>
              )}

              <label style={s.label}>Proveedor</label>
              <button type="button" onClick={() => { setPicker("proveedor"); setPickerBusqueda(""); }} style={s.btnPicker}>
                {idProveedor == null
                  ? "Todos los proveedores"
                  : nombreProveedorSel?.nombre_proveedor ?? idProveedor}
              </button>
              {idProveedor != null && (
                <button type="button" onClick={() => setIdProveedor(null)} style={s.linkBtn}>
                  Quitar filtro
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Modal pickers */}
      {picker && (
        <div style={s.overlay} role="presentation" onClick={() => setPicker(null)}>
          <div style={s.modal} role="dialog" onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>
                {picker === "producto" && "Elegir producto"}
                {picker === "cliente" && "Elegir cliente"}
                {picker === "proveedor" && "Elegir proveedor"}
              </h3>
              <button type="button" style={s.closeBtn} onClick={() => setPicker(null)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "0 1.25rem 1rem" }}>
              <input
                type="search"
                placeholder="Filtrar lista…"
                value={pickerBusqueda}
                onChange={(e) => setPickerBusqueda(e.target.value)}
                style={s.searchInput}
              />
            </div>
            <div style={s.modalList}>
              {picker === "producto" &&
                productosPickerFiltrados.map((p) => (
                  <button
                    key={p.id_producto}
                    type="button"
                    style={s.listItem}
                    onClick={() => {
                      setIdProducto(p.id_producto);
                      setPicker(null);
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.codigo_producto}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{p.nombre_producto}</span>
                  </button>
                ))}
              {picker === "cliente" &&
                clientesPickerFiltrados.map((c) => (
                  <button
                    key={c.id_usuario}
                    type="button"
                    style={s.listItem}
                    onClick={() => {
                      setIdCliente(c.id_usuario);
                      setPicker(null);
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{c.correo}</span>
                  </button>
                ))}
              {picker === "proveedor" &&
                proveedoresPickerFiltrados.map((p) => (
                  <button
                    key={p.id_proveedor}
                    type="button"
                    style={s.listItem}
                    onClick={() => {
                      setIdProveedor(p.id_proveedor);
                      setPicker(null);
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.nombre_proveedor}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>NIT {p.nit_proveedor}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}

function estadoStyle(estado: string): CSSProperties {
  if (estado === "PAGADO") return { background: "rgba(82,183,136,.2)", color: "#52b788", borderColor: "rgba(82,183,136,.4)" };
  if (estado === "PENDIENTE") return { background: "rgba(145,167,255,.15)", color: "#91a7ff", borderColor: "rgba(145,167,255,.35)" };
  return { background: "var(--surface2)", color: "var(--muted)", borderColor: "var(--border)" };
}

const s: Record<string, CSSProperties> = {
  toolbar: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "1.25rem",
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.65rem 1rem",
    color: "var(--text)",
    fontSize: "0.9rem",
    outline: "none",
  },
  btnOutline: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.65rem 1rem",
    cursor: "pointer",
    fontSize: "0.88rem",
    fontWeight: 600,
    fontFamily: "var(--font-body)",
  },
  btnPrimary: {
    background: ACCENT,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "0.55rem 1.1rem",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.88rem",
  },
  tableWrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    background: "var(--surface2)",
    color: "var(--muted)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.75rem 1rem",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "0.75rem 1rem", fontSize: "0.88rem", verticalAlign: "top" },
  code: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "0.12rem 0.4rem",
    fontSize: "0.78rem",
    color: ACCENT,
    fontFamily: "monospace",
  },
  badgeEstado: {
    display: "inline-block",
    fontSize: "0.72rem",
    padding: "0.15rem 0.55rem",
    borderRadius: 99,
    border: "1px solid",
    fontWeight: 600,
  },
  tag: {
    fontSize: "0.65rem",
    padding: "0.08rem 0.35rem",
    borderRadius: 6,
    background: "var(--surface2)",
    color: "var(--muted)",
    border: "1px solid var(--border)",
  },
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    zIndex: 150,
    border: "none",
    cursor: "pointer",
  },
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: "min(400px, 100vw)",
    background: "var(--surface)",
    borderLeft: "1px solid var(--border)",
    boxShadow: "-8px 0 32px rgba(0,0,0,.35)",
    zIndex: 160,
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-body)",
  },
  drawerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  drawerTitle: {
    margin: 0,
    fontFamily: "var(--font-head)",
    fontSize: "1.05rem",
    fontWeight: 700,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontSize: "1.1rem",
    cursor: "pointer",
  },
  drawerBody: {
    padding: "1.25rem",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.65rem",
  },
  label: {
    fontSize: "0.72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--muted)",
    marginTop: "0.5rem",
  },
  btnRow: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  chip: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.4rem 0.65rem",
    fontSize: "0.78rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  rangeRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.78rem",
    color: "var(--muted)",
  },
  rangeVal: { fontVariantNumeric: "tabular-nums" },
  btnPicker: {
    width: "100%",
    textAlign: "left",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.65rem 0.85rem",
    color: "var(--text)",
    fontSize: "0.88rem",
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#91a7ff",
    fontSize: "0.8rem",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    marginTop: "-0.25rem",
  },
  overlay: {
    position: "fixed",
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
    maxWidth: 480,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "var(--shadow)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  modalTitle: {
    margin: 0,
    fontFamily: "var(--font-head)",
    fontSize: "1rem",
    fontWeight: 700,
  },
  modalList: {
    overflowY: "auto",
    maxHeight: "50vh",
    padding: "0.5rem 0",
  },
  listItem: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "0.65rem 1.25rem",
    border: "none",
    borderBottom: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
  },
};
