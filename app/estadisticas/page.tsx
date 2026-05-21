"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PeriodoKey = "day" | "week" | "month" | "quarter" | "year" | "custom";

type EstadisticasData = {
  periodo: { tipo: string; desde: string | null; hasta: string | null };
  resumen: {
    total_ventas: number;
    ingresos_totales: number;
    ticket_promedio: number;
    ventas_canceladas: number;
  };
  estadisticas_descriptivas: {
    media: number;
    mediana: number;
    moda: number[];
    desviacion_estandar: number;
    min_total: number;
    max_total: number;
    n: number;
  };
  ventas_por_dia: { fecha: string; total_dia: number; cantidad: number }[];
  ventas_por_tipo: { tipo_venta: string; cantidad: number; ingresos: number }[];
  ventas_por_estado: { estado_venta: string; cantidad: number }[];
  top_productos: {
    id_producto: number;
    codigo_producto: string;
    nombre_producto: string;
    unidad_medida: string;
    nombre_categoria: string;
    nombre_marca: string;
    total_unidades: number;
    total_ingresos: number;
    veces_vendido: number;
  }[];
  producto_mas_comprado: {
    id_producto: number;
    codigo_producto: string;
    nombre_producto: string;
    unidad_medida: string;
    nombre_categoria: string;
    nombre_marca: string;
    total_unidades: number;
    total_ingresos: number;
    veces_vendido: number;
  } | null;
  top_clientes: {
    id_usuario: number;
    nombre: string;
    correo: string;
    tipo_usuario: string;
    total_compras: number;
    cantidad_pedidos: number;
  }[];
  ingresos_por_categoria: {
    nombre_categoria: string;
    total_ingresos: number;
    total_unidades: number;
  }[];
  ventas_por_hora: { hora: number; cantidad: number }[];
  comparativa_periodo_anterior: {
    total_ventas_anterior: number;
    ingresos_anteriores: number;
  } | null;
  top_bodegas: {
    id_bodega: number;
    nombre_bodega: string;
    total_movimientos: number;
    total_unidades: number;
  }[];
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIODOS: { value: PeriodoKey; label: string }[] = [
  { value: "day",     label: "Hoy" },
  { value: "week",    label: "7 días" },
  { value: "month",   label: "30 días" },
  { value: "quarter", label: "90 días" },
  { value: "year",    label: "Año" },
  { value: "custom",  label: "Personalizado" },
];

const ESTADO_COLOR: Record<string, string> = {
  PAGADO:     "var(--green)",
  PENDIENTE:  "var(--accent)",
  CONFIRMADO: "var(--blue)",
  ENTREGADO:  "var(--green)",
  CANCELADO:  "var(--red)",
};

const CAT_COLORS = [
  "rgba(45,106,79,.85)",
  "rgba(88,166,255,.85)",
  "rgba(232,160,69,.85)",
  "rgba(248,81,73,.85)",
  "rgba(63,185,80,.85)",
  "rgba(180,83,189,.85)",
  "rgba(255,168,68,.85)",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function q(n: number) {
  return `Q${n.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

function fmtDate(iso: string) {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

// ─── Gráficas SVG puras ───────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 100,
        color: "var(--muted)",
        fontSize: "0.82rem",
      }}
    >
      {label}
    </div>
  );
}

/** Barras verticales — ingresos por día */
function BarChart({
  data,
  height = 160,
}: {
  data: { fecha: string; total_dia: number; cantidad: number }[];
  height?: number;
}) {
  if (data.length === 0)
    return <EmptyChart label="Sin datos en el periodo" />;

  const max = Math.max(...data.map((d) => d.total_dia), 1);
  const W = 600;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 28, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.max(4, chartW / data.length - 4);
  const TICKS = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) =>
    Math.round((max / TICKS) * i)
  );
  const step = Math.ceil(data.length / 10);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", overflow: "visible" }}
    >
      {yTicks.map((tick) => {
        const y = PAD.top + chartH - (tick / max) * chartH;
        return (
          <g key={tick}>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={y} y2={y}
              stroke="rgba(48,54,61,.6)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6} y={y + 4}
              textAnchor="end" fontSize={9}
              fill="rgba(139,148,158,.8)"
            >
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const x =
          PAD.left +
          (i / data.length) * chartW +
          (chartW / data.length - barW) / 2;
        const barH = Math.max(2, (d.total_dia / max) * chartH);
        const y = PAD.top + chartH - barH;
        const showLabel = i % step === 0;
        return (
          <g key={d.fecha}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill="rgba(45,106,79,.75)">
              <title>
                {`${d.fecha}: ${q(d.total_dia)} · ${d.cantidad} venta${d.cantidad !== 1 ? "s" : ""}`}
              </title>
            </rect>
            {showLabel && (
              <text
                x={x + barW / 2} y={H - 6}
                textAnchor="middle" fontSize={8}
                fill="rgba(139,148,158,.8)"
              >
                {fmtDate(d.fecha)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Gráfica de dona */
function DonutChart({
  segments,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  if (total === 0) return <EmptyChart label="Sin datos" />;

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const r = size * 0.22;
  let cumAngle = -Math.PI / 2;

  const arcs = segments.map((sg) => {
    const angle = (sg.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle);
    const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle);
    const y2 = cy + R * Math.sin(cumAngle);
    const ix1 = cx + r * Math.cos(cumAngle);
    const iy1 = cy + r * Math.sin(cumAngle);
    const ix2 = cx + r * Math.cos(cumAngle - angle);
    const iy2 = cy + r * Math.sin(cumAngle - angle);
    const large = angle > Math.PI ? 1 : 0;
    const path = [
      `M ${x1} ${y1}`,
      `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");
    return { ...sg, path, pct: Math.round((sg.value / total) * 100) };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: "100%", height: "auto" }}
    >
      {arcs.map((arc) => (
        <path key={arc.label} d={arc.path} fill={arc.color}>
          <title>{`${arc.label}: ${arc.pct}%`}</title>
        </path>
      ))}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle"
        fontSize={size * 0.1}
        fontWeight="700"
        fill="var(--text)"
      >
        {total}
      </text>
      <text
        x={cx} y={cy + size * 0.1}
        textAnchor="middle"
        fontSize={size * 0.07}
        fill="var(--muted)"
      >
        total
      </text>
    </svg>
  );
}

/** Barras horizontales con label + barra de progreso */
function HBarChart({
  data,
  valueKey,
  labelKey,
  color = "rgba(45,106,79,.75)",
  formatValue,
}: {
  data: Record<string, number | string>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) return <EmptyChart label="Sin datos" />;
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]);
        const label = String(d[labelKey]);
        const pctW = (val / max) * 100;
        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.78rem",
                marginBottom: "0.25rem",
              }}
            >
              <span
                style={{
                  color: "var(--text)",
                  fontWeight: 500,
                  maxWidth: "65%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatValue ? formatValue(val) : val.toLocaleString("es-GT")}
              </span>
            </div>
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 4,
                height: 7,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pctW}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 4,
                  transition: "width .5s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Gráfica de área — actividad por hora */
function HourChart({ data }: { data: { hora: number; cantidad: number }[] }) {
  if (data.length === 0)
    return <EmptyChart label="Sin actividad registrada" />;

  const filled = Array.from({ length: 24 }, (_, h) => ({
    hora: h,
    cantidad: data.find((d) => d.hora === h)?.cantidad ?? 0,
  }));

  const max = Math.max(...filled.map((d) => d.cantidad), 1);
  const W = 600;
  const H = 100;
  const PAD = { top: 8, right: 10, bottom: 24, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const pts = filled.map((d, i) => {
    const x = PAD.left + (i / 23) * chartW;
    const y = PAD.top + chartH - (d.cantidad / max) * chartH;
    return `${x},${y}`;
  });

  const areaPath = [
    `M ${PAD.left},${PAD.top + chartH}`,
    ...pts.map((p) => `L ${p}`),
    `L ${PAD.left + chartW},${PAD.top + chartH}`,
    "Z",
  ].join(" ");

  const linePath = [`M ${pts[0]}`].concat(pts.slice(1).map((p) => `L ${p}`)).join(" ");

  const LABELS = [0, 6, 12, 18, 23];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(45,106,79,.45)" />
          <stop offset="100%" stopColor="rgba(45,106,79,.02)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#hourGrad)" />
      <path d={linePath} fill="none" stroke="rgba(45,106,79,.9)" strokeWidth={1.5} strokeLinejoin="round" />
      {filled.map((d, i) => {
        if (!LABELS.includes(d.hora)) return null;
        const x = PAD.left + (i / 23) * chartW;
        return (
          <text key={d.hora} x={x} y={H - 6} textAnchor="middle" fontSize={8} fill="rgba(139,148,158,.7)">
            {d.hora}h
          </text>
        );
      })}
    </svg>
  );
}

// ─── Micro-componentes ────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "0.1rem 0.45rem",
        borderRadius: 99,
        background: up ? "rgba(63,185,80,.12)" : "rgba(248,81,73,.12)",
        color: up ? "var(--green)" : "var(--red)",
        border: `1px solid ${up ? "rgba(63,185,80,.3)" : "rgba(248,81,73,.3)"}`,
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(delta)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  delta?: number | null;
}) {
  return (
    <div style={s.statCard}>
      <div style={s.statCardTop}>
        <span style={s.statIcon}>{icon}</span>
        <span style={s.statLabel}>{label}</span>
      </div>
      <div style={s.statValue}>{value}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "0.35rem",
          flexWrap: "wrap",
        }}
      >
        {sub && <span style={s.statSub}>{sub}</span>}
        {delta !== undefined && <DeltaBadge delta={delta ?? null} />}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...s.card, ...style }}>
      {title && <h3 style={s.cardTitle}>{title}</h3>}
      {children}
    </div>
  );
}

function LegendPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.35rem 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {color && (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ fontSize: "0.82rem", color: "var(--muted)", flex: 1 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "0.88rem",
          fontWeight: 600,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatDescRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "0.65rem 0",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "0.5rem",
      }}
    >
      <div>
        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{label}</div>
        {hint && (
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--border)",
              marginTop: "0.1rem",
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-head)",
          fontSize: "1.05rem",
          fontWeight: 700,
          color: "var(--accent)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function EstadisticasPage() {
  const usuario = useDuenoSession();

  const [periodo, setPeriodo] = useState<PeriodoKey>("month");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState<EstadisticasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(
    async (p: PeriodoKey, d: string, h: string) => {
      setLoading(true);
      setError("");
      try {
        const sp = new URLSearchParams({ periodo: p });
        if (p === "custom") {
          sp.set("desde", d);
          sp.set("hasta", h);
        }
        const res = await fetch(`/api/estadisticas?${sp}`);
        const json = await res.json();
        if (!res.ok)
          throw new Error(json.error || "Error al cargar estadísticas");
        setData(json as EstadisticasData);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!usuario) return;
    fetchData("month", "", "");
  }, [usuario, fetchData]);

  const handleAplicar = () => {
    if (periodo === "custom" && (!desde || !hasta)) {
      setError("Selecciona fechas de inicio y fin.");
      return;
    }
    fetchData(periodo, desde, hasta);
  };

  if (!usuario)
    return (
      <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>
    );

  // Datos derivados
  const comp = data?.comparativa_periodo_anterior ?? null;
  const deltaVentas   = comp ? pct(data!.resumen.total_ventas, comp.total_ventas_anterior) : null;
  const deltaIngresos = comp ? pct(data!.resumen.ingresos_totales, comp.ingresos_anteriores) : null;

  const tipoSegments = (data?.ventas_por_tipo ?? []).map((t, i) => ({
    label: t.tipo_venta,
    value: t.cantidad,
    color: i === 0 ? "rgba(45,106,79,.8)" : "rgba(88,166,255,.8)",
  }));

  const estadoSegments = (data?.ventas_por_estado ?? []).map((e) => ({
    label: e.estado_venta,
    value: e.cantidad,
    color: ESTADO_COLOR[e.estado_venta] ?? "var(--muted)",
  }));

  const periodoLabel =
    PERIODOS.find((p) => p.value === periodo)?.label ?? "";

  const subtitle = loading
    ? "Cargando estadísticas…"
    : data
    ? `Periodo: ${periodoLabel}${periodo === "custom" ? ` · ${desde} → ${hasta}` : ""} · ${data.resumen.total_ventas} ventas`
    : "Resumen estadístico de ventas";

  return (
    <StaffShell usuario={usuario} title="Estadísticas" subtitle={subtitle}>

      {/* ── Selector de periodo ─────────────────────────────────────────────── */}
      <div style={s.filterBar}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              style={{
                ...s.chip,
                background:
                  periodo === p.value
                    ? "rgba(45,106,79,.18)"
                    : "transparent",
                borderColor:
                  periodo === p.value
                    ? "rgba(45,106,79,.55)"
                    : "var(--border)",
                color: periodo === p.value ? "var(--text)" : "var(--muted)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodo === "custom" && (
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={s.miniLabel}>Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                style={s.dateInput}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={s.miniLabel}>Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                style={s.dateInput}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleAplicar}
          disabled={loading}
          style={s.btnPrimary}
        >
          {loading ? "Cargando…" : "Aplicar"}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── Estado vacío ───────────────────────────────────────────────────── */}
      {!data && !loading && !error && (
        <div style={s.emptyState}>
          <span style={{ fontSize: "2.5rem" }}>📊</span>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            Selecciona un periodo y presiona Aplicar.
          </p>
        </div>
      )}

      {/* ── Skeleton mientras carga ─────────────────────────────────────────── */}
      {loading && !data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ ...s.statsGrid }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ ...s.statCard, ...s.skeleton, height: 100 }} />
            ))}
          </div>
          <div style={{ ...s.card, ...s.skeleton, height: 220 }} />
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Fila 1 — Tarjetas de resumen */}
          <div style={s.statsGrid}>
            <StatCard
              icon="🧾"
              label="Ventas totales"
              value={data.resumen.total_ventas.toLocaleString("es-GT")}
              sub={comp ? `vs ${comp.total_ventas_anterior} periodo ant.` : undefined}
              delta={deltaVentas}
            />
            <StatCard
              icon="💰"
              label="Ingresos totales"
              value={q(data.resumen.ingresos_totales)}
              sub={comp ? `vs ${q(comp.ingresos_anteriores)} periodo ant.` : undefined}
              delta={deltaIngresos}
            />
            <StatCard
              icon="🎟"
              label="Ticket promedio"
              value={q(data.resumen.ticket_promedio)}
              sub="por venta (media)"
            />
            <StatCard
              icon="✕"
              label="Canceladas"
              value={data.resumen.ventas_canceladas.toLocaleString("es-GT")}
              sub="excluidas de ingresos"
            />
          </div>

          {/* Fila 2 — Gráfica de barras + Producto #1 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 300px",
              gap: "1.25rem",
            }}
          >
            <Card title="Ingresos diarios (Q)">
              <BarChart data={data.ventas_por_dia} />
              {data.ventas_por_dia.length > 0 && (() => {
                const peak = data.ventas_por_dia.reduce((a, b) =>
                  b.total_dia > a.total_dia ? b : a
                );
                return (
                  <p style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                    Día pico:{" "}
                    <strong style={{ color: "var(--accent)" }}>{peak.fecha}</strong>
                    {" · "}{q(peak.total_dia)} en {peak.cantidad} venta{peak.cantidad !== 1 ? "s" : ""}
                  </p>
                );
              })()}
            </Card>

            {data.producto_mas_comprado ? (
              <div style={s.heroCard}>
                <div style={s.heroBadge}>⭐ Producto #1</div>
                <div style={s.heroName}>
                  {data.producto_mas_comprado.nombre_producto}
                </div>
                <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,.55)", marginBottom: "1rem" }}>
                  <code style={s.heroCode}>
                    {data.producto_mas_comprado.codigo_producto}
                  </code>
                  {" · "}{data.producto_mas_comprado.nombre_categoria}
                  {" · "}{data.producto_mas_comprado.nombre_marca}
                </div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  {[
                    {
                      val: `${data.producto_mas_comprado.total_unidades.toLocaleString("es-GT", { maximumFractionDigits: 2 })}`,
                      sub: data.producto_mas_comprado.unidad_medida + " vendidas",
                    },
                    {
                      val: q(data.producto_mas_comprado.total_ingresos),
                      sub: "en ingresos",
                    },
                    {
                      val: String(data.producto_mas_comprado.veces_vendido),
                      sub: "pedidos",
                    },
                  ].map(({ val, sub }) => (
                    <div key={sub} style={s.heroStat}>
                      <span style={s.heroStatVal}>{val}</span>
                      <span style={s.heroStatSub}>{sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Card title="Producto más vendido">
                <EmptyChart label="Sin ventas en el periodo" />
              </Card>
            )}
          </div>

          {/* Fila 3 — Estadísticas descriptivas */}
          <Card title="Estadísticas descriptivas de tickets (Q)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "0 2.5rem",
              }}
            >
              {/* Columna 1 */}
              <div>
                <StatDescRow
                  label="Media (promedio)"
                  value={q(data.estadisticas_descriptivas.media)}
                  hint="Suma de totales ÷ cantidad de ventas"
                />
                <StatDescRow
                  label="Mediana"
                  value={q(data.estadisticas_descriptivas.mediana)}
                  hint="Valor central del conjunto ordenado"
                />
                <StatDescRow
                  label="Moda"
                  value={
                    data.estadisticas_descriptivas.moda.length > 0
                      ? data.estadisticas_descriptivas.moda.map(q).join(", ")
                      : "Sin moda (todos distintos)"
                  }
                  hint="Ticket(s) más repetidos"
                />
              </div>

              {/* Columna 2 */}
              <div>
                <StatDescRow
                  label="Desviación estándar"
                  value={q(data.estadisticas_descriptivas.desviacion_estandar)}
                  hint="Dispersión respecto a la media (poblacional)"
                />
                <StatDescRow
                  label="Ticket mínimo"
                  value={q(data.estadisticas_descriptivas.min_total)}
                />
                <StatDescRow
                  label="Ticket máximo"
                  value={q(data.estadisticas_descriptivas.max_total)}
                />
              </div>

              {/* N ventas */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "1rem 0",
                }}
              >
                <div style={s.nBox}>
                  <span style={s.nVal}>
                    {data.estadisticas_descriptivas.n}
                  </span>
                  <span style={s.nLabel}>ventas analizadas</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Fila 4 — Donas + Bodegas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1.25rem",
            }}
          >
            {/* Dona tipo de venta */}
            <Card title="Por tipo de venta">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <div style={{ width: 110, flexShrink: 0 }}>
                  <DonutChart segments={tipoSegments} size={110} />
                </div>
                <div style={{ flex: 1 }}>
                  {data.ventas_por_tipo.map((t, i) => (
                    <LegendPill
                      key={t.tipo_venta}
                      color={tipoSegments[i]?.color}
                      label={t.tipo_venta}
                      value={`${t.cantidad} · ${q(t.ingresos)}`}
                    />
                  ))}
                  {data.ventas_por_tipo.length === 0 && (
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      Sin datos
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Dona por estado */}
            <Card title="Por estado">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <div style={{ width: 110, flexShrink: 0 }}>
                  <DonutChart segments={estadoSegments} size={110} />
                </div>
                <div style={{ flex: 1 }}>
                  {data.ventas_por_estado.map((e) => (
                    <LegendPill
                      key={e.estado_venta}
                      color={ESTADO_COLOR[e.estado_venta]}
                      label={e.estado_venta}
                      value={e.cantidad}
                    />
                  ))}
                  {data.ventas_por_estado.length === 0 && (
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      Sin datos
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Top bodegas */}
            <Card title="Bodegas con mayor movimiento">
              {data.top_bodegas.length === 0 ? (
                <EmptyChart label="Sin movimientos en el periodo" />
              ) : (
                <HBarChart
                  data={
                    data.top_bodegas as unknown as Record<string, number | string>[]
                  }
                  labelKey="nombre_bodega"
                  valueKey="total_unidades"
                  formatValue={(v) =>
                    `${v.toLocaleString("es-GT", { maximumFractionDigits: 2 })} u.`
                  }
                  color="rgba(88,166,255,.75)"
                />
              )}
            </Card>
          </div>

          {/* Fila 5 — Top productos + Categorías */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.25rem",
            }}
          >
            {/* Tabla top 10 productos */}
            <Card title="Top 10 productos más vendidos (unidades)">
              {data.top_productos.length === 0 ? (
                <EmptyChart label="Sin ventas en el periodo" />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Producto</th>
                        <th style={{ ...s.th, textAlign: "right" }}>Unidades</th>
                        <th style={{ ...s.th, textAlign: "right" }}>Ingresos</th>
                        <th style={{ ...s.th, textAlign: "right" }}>Pedidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_productos.map((p, i) => (
                        <tr
                          key={p.id_producto}
                          style={{ borderTop: "1px solid var(--border)" }}
                        >
                          <td
                            style={{
                              ...s.td,
                              color: i === 0 ? "var(--accent)" : "var(--muted)",
                              fontWeight: i === 0 ? 700 : 400,
                              width: 28,
                            }}
                          >
                            {i === 0 ? "⭐" : i + 1}
                          </td>
                          <td style={s.td}>
                            <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>
                              {p.nombre_producto}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                              <code
                                style={{
                                  color: "var(--accent)",
                                  fontSize: "0.7rem",
                                  background: "var(--surface2)",
                                  padding: "0.05rem 0.3rem",
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                }}
                              >
                                {p.codigo_producto}
                              </code>
                              {" · "}{p.nombre_categoria}
                            </div>
                          </td>
                          <td
                            style={{
                              ...s.td,
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {p.total_unidades.toLocaleString("es-GT", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                              {p.unidad_medida}
                            </span>
                          </td>
                          <td
                            style={{
                              ...s.td,
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {q(p.total_ingresos)}
                          </td>
                          <td style={{ ...s.td, textAlign: "right" }}>
                            {p.veces_vendido}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Ingresos por categoría */}
            <Card title="Ingresos por categoría">
              {data.ingresos_por_categoria.length === 0 ? (
                <EmptyChart label="Sin datos" />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                >
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <DonutChart
                        segments={data.ingresos_por_categoria.map((c, i) => ({
                          label: c.nombre_categoria,
                          value: c.total_ingresos,
                          color: CAT_COLORS[i % CAT_COLORS.length],
                        }))}
                        size={100}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      {data.ingresos_por_categoria.map((c, i) => (
                        <LegendPill
                          key={c.nombre_categoria}
                          color={CAT_COLORS[i % CAT_COLORS.length]}
                          label={c.nombre_categoria}
                          value={q(c.total_ingresos)}
                        />
                      ))}
                    </div>
                  </div>
                  <HBarChart
                    data={
                      data.ingresos_por_categoria as unknown as Record<
                        string,
                        number | string
                      >[]
                    }
                    labelKey="nombre_categoria"
                    valueKey="total_ingresos"
                    formatValue={q}
                    color="rgba(232,160,69,.75)"
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Fila 6 — Hora del día + Top clientes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.25rem",
            }}
          >
            {/* Gráfica de actividad por hora */}
            <Card title="Actividad por hora del día">
              <HourChart data={data.ventas_por_hora} />
              {data.ventas_por_hora.length > 0 && (() => {
                const peak = data.ventas_por_hora.reduce((a, b) =>
                  b.cantidad > a.cantidad ? b : a
                );
                return (
                  <p style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                    Hora pico:{" "}
                    <strong style={{ color: "var(--accent)" }}>
                      {peak.hora}:00 h
                    </strong>
                    {" · "}{peak.cantidad} venta{peak.cantidad !== 1 ? "s" : ""}
                  </p>
                );
              })()}
            </Card>

            {/* Top 5 clientes */}
            <Card title="Top 5 clientes por ingresos">
              {data.top_clientes.length === 0 ? (
                <EmptyChart label="Sin datos en el periodo" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.top_clientes.map((c, i) => (
                    <div
                      key={c.id_usuario}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.65rem 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {/* Avatar / posición */}
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background:
                            i === 0
                              ? "rgba(45,106,79,.25)"
                              : "var(--surface2)",
                          border: `1px solid ${
                            i === 0
                              ? "rgba(45,106,79,.45)"
                              : "var(--border)"
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color:
                            i === 0 ? "var(--accent)" : "var(--muted)",
                        }}
                      >
                        {i === 0 ? "⭐" : i + 1}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: "0.85rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.nombre}
                        </div>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.correo}
                        </div>
                      </div>

                      {/* Totales */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: "var(--text)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {q(c.total_compras)}
                        </div>
                        <div
                          style={{ fontSize: "0.72rem", color: "var(--muted)" }}
                        >
                          {c.cantidad_pedidos} pedido
                          {c.cantidad_pedidos !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

        </div>
      )}
    </StaffShell>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  // Filtro
  filterBar: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "flex-end",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "0.85rem 1.1rem",
    marginBottom: "1.25rem",
  },
  chip: {
    border: "1px solid var(--border)",
    borderRadius: 99,
    padding: "0.4rem 0.85rem",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
    fontFamily: "var(--font-body)",
  },
  dateInput: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.45rem 0.65rem",
    color: "var(--text)",
    fontSize: "0.85rem",
    outline: "none",
  },
  miniLabel: {
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "#0d1117",
    border: "none",
    borderRadius: 8,
    padding: "0.55rem 1.1rem",
    fontFamily: "var(--font-head)",
    fontSize: "0.85rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  errorBox: {
    background: "rgba(248,81,73,.12)",
    border: "1px solid rgba(248,81,73,.3)",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    color: "var(--red)",
    fontSize: "0.88rem",
    marginBottom: "1rem",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "4rem 2rem",
    background: "var(--surface)",
    border: "1px dashed var(--border)",
    borderRadius: 14,
  },
  skeleton: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    opacity: 0.5,
  },

  // Stat cards
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.1rem 1.25rem",
  },
  statCardTop: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  statIcon: { fontSize: "1.1rem" },
  statLabel: {
    fontSize: "0.72rem",
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  statValue: {
    fontFamily: "var(--font-head)",
    fontSize: "1.55rem",
    fontWeight: 700,
    color: "var(--accent)",
    lineHeight: 1.1,
  },
  statSub: { fontSize: "0.72rem", color: "var(--muted)" },

  // Generic card
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.1rem 1.25rem",
  },
  cardTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "0.82rem",
    fontWeight: 700,
    color: "var(--muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "0.9rem",
  },

  // Hero producto
  heroCard: {
    background:
      "linear-gradient(145deg, rgba(45,106,79,.35) 0%, rgba(45,106,79,.1) 100%)",
    border: "1px solid rgba(45,106,79,.4)",
    borderRadius: 12,
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0",
  },
  heroBadge: {
    display: "inline-block",
    background: "rgba(232,160,69,.2)",
    border: "1px solid rgba(232,160,69,.4)",
    color: "var(--accent)",
    fontSize: "0.7rem",
    fontWeight: 700,
    padding: "0.2rem 0.65rem",
    borderRadius: 99,
    marginBottom: "0.6rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    alignSelf: "flex-start",
  },
  heroName: {
    fontFamily: "var(--font-head)",
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: "0.3rem",
    lineHeight: 1.25,
  },
  heroCode: {
    background: "rgba(0,0,0,.25)",
    padding: "0.1rem 0.4rem",
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: "0.75rem",
  },
  heroStat: {
    display: "flex",
    flexDirection: "column" as const,
    background: "rgba(0,0,0,.2)",
    borderRadius: 8,
    padding: "0.5rem 0.75rem",
    flex: "1 1 70px",
    marginTop: "0.75rem",
  },
  heroStatVal: {
    fontFamily: "var(--font-head)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--accent)",
    lineHeight: 1.1,
    fontVariantNumeric: "tabular-nums" as const,
  },
  heroStatSub: {
    fontSize: "0.68rem",
    color: "rgba(255,255,255,.45)",
    marginTop: "0.15rem",
  },

  // N box
  nBox: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(45,106,79,.08)",
    border: "1px solid rgba(45,106,79,.2)",
    borderRadius: 12,
    padding: "1.5rem 2rem",
    gap: "0.35rem",
  },
  nVal: {
    fontFamily: "var(--font-head)",
    fontSize: "2.5rem",
    fontWeight: 800,
    color: "var(--accent)",
    lineHeight: 1,
  },
  nLabel: {
    fontSize: "0.78rem",
    color: "var(--muted)",
    textAlign: "center" as const,
  },

  // Tabla
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    padding: "0.4rem 0.5rem",
    textAlign: "left" as const,
    borderBottom: "1px solid var(--border)",
    background: "var(--surface2)",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "0.5rem 0.5rem",
    fontSize: "0.82rem",
    color: "var(--text)",
    verticalAlign: "middle" as const,
  },
};