"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { HISTORIAL_VENTAS_DEFAULT_LIMIT } from "@/lib/historial-ventas";
import { TIPOS_USUARIO } from "@/lib/roles";
import { filtrarClientesPorTexto } from "@/lib/clientes-busqueda";

type LineaHistorial = {
  unidad_medida?: string;
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
  codigo_cliente?: string | null;
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
  // El API de clientes devuelve id_cliente (no id_usuario): con el nombre
  // equivocado el filtro por cliente nunca encontraba al cliente elegido.
  id_cliente: number;
  nombre: string;
  correo: string | null;
  codigo_cliente?: string | null;
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

/**
 * Clases Tailwind reutilizables (DEV-192). Reemplazan al antiguo objeto
 * `s: Record<string, CSSProperties>` y a los inline styles. Los colores salen
 * de los tokens del tema (surface, surface-soft, line, ink, success, info),
 * que a su vez mapean a las variables CSS de globals.css.
 */
const cls = {
  toolbar: "flex gap-3 flex-wrap items-center mb-5",
  searchInput:
    "flex-1 min-w-[200px] bg-surface-soft border border-line rounded-[10px] px-4 py-[0.65rem] text-ink text-[0.9rem] outline-none",
  btnOutlineBase:
    "bg-transparent border rounded-[10px] px-4 py-[0.65rem] cursor-pointer text-[0.88rem] font-semibold font-body",
  btnPrimary:
    "bg-success-strong text-white border-none rounded-[10px] px-[1.1rem] py-[0.55rem] font-semibold cursor-pointer text-[0.88rem]",
  tableWrapper: "bg-surface border border-line rounded-control overflow-auto",
  table: "w-full border-collapse",
  th: "bg-surface-soft text-ink-muted text-[0.72rem] font-semibold tracking-[0.06em] uppercase px-4 py-3 text-left border-b border-line",
  td: "px-4 py-3 text-[0.88rem] align-top",
  code: "bg-surface-soft border border-line rounded px-[0.4rem] py-[0.12rem] text-[0.78rem] text-success-strong font-mono",
  badgeEstado:
    "inline-block text-[0.72rem] px-[0.55rem] py-[0.15rem] rounded-full border font-semibold",
  tag: "text-[0.65rem] px-[0.35rem] py-[0.08rem] rounded-md bg-surface-soft text-ink-muted border border-line",
  closeBtn: "bg-transparent border-none text-ink-muted text-[1.1rem] cursor-pointer",
  label:
    "text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-muted mt-2",
  btnRow: "flex flex-wrap gap-[0.4rem]",
  chipBase: "border rounded-lg px-[0.65rem] py-[0.4rem] text-[0.78rem] font-semibold",
  rangeRow: "flex justify-between text-[0.78rem] text-ink-muted",
  rangeVal: "tabular-nums",
  dateLabel: "text-[0.72rem] text-ink-muted",
  dateInput:
    "bg-surface-soft border border-line rounded-[10px] px-[0.7rem] py-[0.55rem] text-ink text-[0.85rem] font-body [color-scheme:dark] outline-none",
  btnPicker:
    "w-full text-left bg-surface-soft border border-line rounded-[10px] px-[0.85rem] py-[0.65rem] text-ink text-[0.88rem] cursor-pointer",
  linkBtn:
    "bg-none border-none text-info text-[0.8rem] cursor-pointer text-left p-0 -mt-1",
  listItem:
    "w-full flex flex-col items-start gap-0.5 px-5 py-[0.65rem] border-b border-line bg-transparent text-ink cursor-pointer text-left",
};

/** Clases del badge de estado según el valor. Antes era estadoStyle() con hex. */
function estadoClass(estado: string): string {
  if (estado === "PAGADO")
    return "bg-[var(--success-bg)] text-success border-[var(--success-border)]";
  if (estado === "PENDIENTE")
    return "bg-[var(--info-chip)] text-info border-[var(--info-border)]";
  return "bg-surface-soft text-ink-muted border-line";
}

function num(v: string | number | unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return 0;
}

function buildHistorialParams(opts: {
  q: string;
  periodo: string;
  fechaDesde: string;
  fechaHasta: string;
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
  if (opts.fechaDesde) sp.set("fecha_desde", opts.fechaDesde);
  if (opts.fechaHasta) sp.set("fecha_hasta", opts.fechaHasta);
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
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
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
      `${debouncedQ}|${periodo}|${fechaDesde}|${fechaHasta}|${idProducto ?? ""}|${idCliente ?? ""}|${idProveedor ?? ""}`,
    [debouncedQ, periodo, fechaDesde, fechaHasta, idProducto, idCliente, idProveedor]
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
        fechaDesde,
        fechaHasta,
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
      fechaDesde,
      fechaHasta,
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
  const nombreClienteSel = clientesCat.find((c) => c.id_cliente === idCliente);
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
    if (!pickerBusqueda.trim()) return clientesCat;
    return filtrarClientesPorTexto(clientesCat, pickerBusqueda);
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
    return <p className="p-8 text-ink-muted font-body">Cargando…</p>;
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
      <div className={cls.toolbar}>
        <input
          type="search"
          placeholder="Buscar por cliente, producto, proveedor, # venta…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={cls.searchInput}
        />
        <button
          type="button"
          onClick={() => setPanelFiltros((x) => !x)}
          className={`${cls.btnOutlineBase} ${
            panelFiltros
              ? "border-success-strong text-success-strong"
              : "border-line text-ink-muted"
          }`}
        >
          {panelFiltros ? "Ocultar filtros" : "Filtros"}
        </button>
      </div>

      {error && (
        <p className="text-achiote mb-3 text-[0.9rem]">{error}</p>
      )}

      <div className={cls.tableWrapper}>
        <table className={cls.table}>
          <thead>
            <tr>
              <th className={cls.th}>#</th>
              <th className={cls.th}>Fecha</th>
              <th className={cls.th}>Cliente</th>
              <th className={cls.th}>Resumen</th>
              <th className={`${cls.th} text-right`}>Total</th>
              <th className={cls.th}>Estado</th>
              <th className={cls.th}>Tipo</th>
              <th className={cls.th}>Colaborador</th>
            </tr>
          </thead>
          <tbody>
            {cargando && ventas.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${cls.td} text-center text-ink-muted`}>
                  Cargando…
                </td>
              </tr>
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${cls.td} text-center text-ink-muted`}>
                  No hay ventas con los filtros actuales.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr key={v.id_venta} className="border-b border-line">
                  <td className={cls.td}>
                    <code className={cls.code}>{v.id_venta}</code>
                  </td>
                  <td className={`${cls.td} text-ink-muted whitespace-nowrap`}>
                    {new Date(v.fecha_venta).toLocaleString("es-GT", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className={cls.td}>
                    <div className="font-medium">{v.nombre_cliente}</div>
                    <div className="text-[0.78rem] text-ink-muted">
                      {v.codigo_cliente ? `${v.codigo_cliente} · ` : ""}
                      {v.correo_cliente}
                    </div>
                  </td>
                  <td className={`${cls.td} max-w-[220px]`}>
                    {resumenLineas(v)}
                    {v.productos?.some((p) => p.unidad_medida) && (
                      <div className="text-xs text-ink-muted">{v.productos.map((p) => `${p.cantidad}${p.unidad_medida ? ` ${p.unidad_medida}` : ""}`).join(" · ")}</div>
                    )}
                  </td>
                  <td className={`${cls.td} text-right font-semibold`}>Q{num(v.total).toFixed(2)}</td>
                  <td className={cls.td}>
                    <span className={`${cls.badgeEstado} ${estadoClass(v.estado_venta)}`}>{v.estado_venta}</span>
                  </td>
                  <td className={cls.td}>
                    <span className="text-[0.8rem] text-ink-muted">{v.tipo_venta}</span>
                    {v.enlinea ? (
                      <span className={`${cls.tag} ml-1.5`}>En línea</span>
                    ) : null}
                  </td>
                  <td className={`${cls.td} text-ink-muted`}>{v.nombre_colaborador ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-3 items-center">
        {pagination?.hasMore && (
          <button
            type="button"
            disabled={cargando || pagination.nextOffset == null}
            onClick={() => pagination.nextOffset != null && setOffset(pagination.nextOffset)}
            className={cls.btnPrimary}
          >
            Cargar más
          </button>
        )}
        {cargando && ventas.length > 0 && (
          <span className="text-ink-muted text-[0.85rem]">Actualizando…</span>
        )}
      </div>

      {/* Panel lateral filtros */}
      {panelFiltros && (
        <>
          {/* Overlay / Backdrop */}
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => setPanelFiltros(false)}
            className="fixed top-0 left-0 w-screen h-screen bg-black/50 border-none z-[99] cursor-pointer"
          />
          {/* Drawer / Panel lateral */}
          <aside className="fixed top-0 right-0 w-[320px] h-screen bg-surface text-ink border-l border-line shadow-[-4px_0_12px_rgba(0,0,0,0.3)] z-[100] overflow-y-auto flex flex-col font-body">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h2 className="m-0 font-head text-[1.05rem] font-bold">Filtros</h2>
              <button type="button" onClick={() => setPanelFiltros(false)} className={cls.closeBtn}>
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex flex-col gap-[0.65rem]">
              <label className={cls.label}>Periodo</label>
              <div className={cls.btnRow}>
                {PERIODOS.map((p) => {
                  const fechaActiva = Boolean(fechaDesde || fechaHasta);
                  const disabled = fechaActiva && p.value !== "";
                  const activo = periodo === p.value;
                  return (
                    <button
                      key={p.value || "all"}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setFechaDesde("");
                        setFechaHasta("");
                        setPeriodo(p.value);
                      }}
                      className={`${cls.chipBase} ${
                        activo
                          ? "bg-[var(--success-soft)] border-success-strong text-success-light"
                          : "bg-surface-soft border-line text-ink"
                      } ${disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <label className={cls.label}>Rango de fechas</label>
              <div className={`flex gap-2 items-end ${periodo ? "opacity-45" : ""}`}>
                <div className="flex-1 flex flex-col gap-[0.3rem]">
                  <label htmlFor="fecha-desde" className={cls.dateLabel}>Desde</label>
                  <input
                    id="fecha-desde"
                    type="date"
                    value={fechaDesde}
                    disabled={Boolean(periodo)}
                    max={fechaHasta || undefined}
                    onChange={(e) => {
                      setPeriodo("");
                      setFechaDesde(e.target.value);
                    }}
                    className={cls.dateInput}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-[0.3rem]">
                  <label htmlFor="fecha-hasta" className={cls.dateLabel}>Hasta</label>
                  <input
                    id="fecha-hasta"
                    type="date"
                    value={fechaHasta}
                    disabled={Boolean(periodo)}
                    min={fechaDesde || undefined}
                    onChange={(e) => {
                      setPeriodo("");
                      setFechaHasta(e.target.value);
                    }}
                    className={cls.dateInput}
                  />
                </div>
              </div>
              {(fechaDesde || fechaHasta) && (
                <button
                  type="button"
                  onClick={() => {
                    setFechaDesde("");
                    setFechaHasta("");
                  }}
                  className={cls.linkBtn}
                >
                  Quitar filtro de fechas
                </button>
              )}

              <label className={cls.label}>Total venta (Q)</label>
              {!rangosMontosListos ? (
                <p className="text-ink-muted text-[0.85rem] m-0">
                  Cargando rango de totales…
                </p>
              ) : (
                <>
                  <div className={cls.rangeRow}>
                    <span className={cls.rangeVal}>Min: Q{(minTotal ?? 0).toFixed(2)}</span>
                    <span className={cls.rangeVal}>Max: Q{(maxTotal ?? sliderMaxBound).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={sliderMinBound}
                    max={sliderMaxBound}
                    step={1}
                    value={Math.min(Math.max(minTotal ?? 0, sliderMinBound), sliderMaxBound)}
                    onChange={(e) => onMinSlider(Number(e.target.value))}
                    className="w-full accent-success-strong"
                  />
                  <input
                    type="range"
                    min={sliderMinBound}
                    max={sliderMaxBound}
                    step={1}
                    value={Math.min(Math.max(maxTotal ?? sliderMaxBound, sliderMinBound), sliderMaxBound)}
                    onChange={(e) => onMaxSlider(Number(e.target.value))}
                    className="w-full accent-success-strong mt-2"
                  />
                </>
              )}

              <label className={cls.label}>Producto</label>
              <button type="button" onClick={() => { setPicker("producto"); setPickerBusqueda(""); }} className={cls.btnPicker}>
                {idProducto == null
                  ? "Todos los productos"
                  : `${nombreProductoSel?.codigo_producto ?? idProducto} — ${nombreProductoSel?.nombre_producto ?? ""}`}
              </button>
              {idProducto != null && (
                <button type="button" onClick={() => setIdProducto(null)} className={cls.linkBtn}>
                  Quitar filtro
                </button>
              )}

              <label className={cls.label}>Cliente</label>
              <button type="button" onClick={() => { setPicker("cliente"); setPickerBusqueda(""); }} className={cls.btnPicker}>
                {idCliente == null
                  ? "Todos los clientes"
                  : `${nombreClienteSel?.nombre ?? idCliente}`}
              </button>
              {idCliente != null && (
                <button type="button" onClick={() => setIdCliente(null)} className={cls.linkBtn}>
                  Quitar filtro
                </button>
              )}

              <label className={cls.label}>Proveedor</label>
              <button type="button" onClick={() => { setPicker("proveedor"); setPickerBusqueda(""); }} className={cls.btnPicker}>
                {idProveedor == null
                  ? "Todos los proveedores"
                  : nombreProveedorSel?.nombre_proveedor ?? idProveedor}
              </button>
              {idProveedor != null && (
                <button type="button" onClick={() => setIdProveedor(null)} className={cls.linkBtn}>
                  Quitar filtro
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Modal pickers */}
      {picker && (
        <div
          className="fixed inset-0 w-screen h-screen bg-black/50 backdrop-blur-[4px] flex items-center justify-center z-[101] p-4"
          role="presentation"
          onClick={() => setPicker(null)}
        >
          <div
            className="bg-surface text-ink border border-line rounded-[12px] w-[90%] max-w-[480px] max-h-[80vh] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
              <h3 className="m-0 font-head text-base font-bold text-ink">
                {picker === "producto" && "Elegir producto"}
                {picker === "cliente" && "Elegir cliente"}
                {picker === "proveedor" && "Elegir proveedor"}
              </h3>
              <button
                type="button"
                className="bg-transparent border-none text-ink text-[1.1rem] cursor-pointer"
                onClick={() => setPicker(null)}
              >
                ✕
              </button>
            </div>
            <div className="px-5 pb-4">
              <input
                type="search"
                placeholder="Filtrar lista…"
                value={pickerBusqueda}
                onChange={(e) => setPickerBusqueda(e.target.value)}
                className={cls.searchInput}
              />
            </div>
            <div className="overflow-y-auto max-h-[50vh] px-5 pb-5 pt-0">
              {picker === "producto" &&
                productosPickerFiltrados.map((p) => (
                  <button
                    key={p.id_producto}
                    type="button"
                    className={cls.listItem}
                    onClick={() => {
                      setIdProducto(p.id_producto);
                      setPicker(null);
                    }}
                  >
                    <span className="font-semibold block">{p.codigo_producto}</span>
                    <span className="text-ink-muted text-[0.85rem]">{p.nombre_producto}</span>
                  </button>
                ))}
              {picker === "cliente" &&
                clientesPickerFiltrados.map((c) => (
                  <button
                    key={c.id_cliente}
                    type="button"
                    className={cls.listItem}
                    onClick={() => {
                      setIdCliente(c.id_cliente);
                      setPicker(null);
                    }}
                  >
                    <span className="font-semibold block">{c.nombre}</span>
                    <span className="text-ink-muted text-[0.85rem]">
                      {c.codigo_cliente ? `${c.codigo_cliente} · ` : ""}
                      {c.correo}
                    </span>
                  </button>
                ))}
              {picker === "proveedor" &&
                proveedoresPickerFiltrados.map((p) => (
                  <button
                    key={p.id_proveedor}
                    type="button"
                    className={cls.listItem}
                    onClick={() => {
                      setIdProveedor(p.id_proveedor);
                      setPicker(null);
                    }}
                  >
                    <span className="font-semibold block">{p.nombre_proveedor}</span>
                    <span className="text-ink-muted text-[0.85rem]">NIT {p.nit_proveedor}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
