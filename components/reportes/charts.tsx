import { fmtDate, q } from "./utils";

export function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 100, color: "var(--muted)", fontSize: "0.82rem" }}>
      {label}
    </div>
  );
}

export function BarChart({ data, height = 160 }: { data: { fecha: string; total_dia: number; cantidad: number }[]; height?: number }) {
  if (data.length === 0) return <EmptyChart label="Sin datos en el periodo" />;
  const max = Math.max(...data.map((d) => d.total_dia), 1);
  const W = 600; const H = height;
  const PAD = { top: 10, right: 10, bottom: 28, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.max(4, chartW / data.length - 4);
  const TICKS = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => Math.round((max / TICKS) * i));
  const step = Math.ceil(data.length / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {yTicks.map((tick) => {
        const y = PAD.top + chartH - (tick / max) * chartH;
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(48,54,61,.6)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="rgba(139,148,158,.8)">{tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = PAD.left + (i / data.length) * chartW + (chartW / data.length - barW) / 2;
        const barH = Math.max(2, (d.total_dia / max) * chartH);
        const y = PAD.top + chartH - barH;
        const showLabel = i % step === 0;
        return (
          <g key={d.fecha}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill="rgba(45,106,79,.75)">
              <title>{`${d.fecha}: ${q(d.total_dia)} · ${d.cantidad} venta${d.cantidad !== 1 ? "s" : ""}`}</title>
            </rect>
            {showLabel && <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={8} fill="rgba(139,148,158,.8)">{fmtDate(d.fecha)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ segments, size = 160 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  if (total === 0) return <EmptyChart label="Sin datos" />;
  const cx = size / 2; const cy = size / 2; const R = size * 0.38; const r = size * 0.22;
  let cumAngle = -Math.PI / 2;
  const arcs = segments.map((sg) => {
    const angle = (sg.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle); const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle); const y2 = cy + R * Math.sin(cumAngle);
    const ix1 = cx + r * Math.cos(cumAngle); const iy1 = cy + r * Math.sin(cumAngle);
    const ix2 = cx + r * Math.cos(cumAngle - angle); const iy2 = cy + r * Math.sin(cumAngle - angle);
    const large = angle > Math.PI ? 1 : 0;
    const path = [`M ${x1} ${y1}`, `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`, `L ${ix1} ${iy1}`, `A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2}`, "Z"].join(" ");
    return { ...sg, path, pct: Math.round((sg.value / total) * 100) };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: "auto" }}>
      {arcs.map((arc) => (<path key={arc.label} d={arc.path} fill={arc.color}><title>{`${arc.label}: ${arc.pct}%`}</title></path>))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.1} fontWeight="700" fill="var(--text)">{total}</text>
      <text x={cx} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.07} fill="var(--muted)">total</text>
    </svg>
  );
}

export function HBarChart({ data, valueKey, labelKey, color = "rgba(45,106,79,.75)", formatValue }: { data: Record<string, number | string>[]; valueKey: string; labelKey: string; color?: string; formatValue?: (v: number) => string }) {
  if (data.length === 0) return <EmptyChart label="Sin datos" />;
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]); const label = String(d[labelKey]); const pctW = (val / max) * 100;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text)", fontWeight: 500, maxWidth: "65%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{formatValue ? formatValue(val) : val.toLocaleString("es-GT")}</span>
            </div>
            <div style={{ background: "var(--surface2)", borderRadius: 4, height: 7, overflow: "hidden" }}>
              <div style={{ width: `${pctW}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HourChart({ data }: { data: { hora: number; cantidad: number }[] }) {
  if (data.length === 0) return <EmptyChart label="Sin actividad registrada" />;
  const filled = Array.from({ length: 24 }, (_, h) => ({ hora: h, cantidad: data.find((d) => d.hora === h)?.cantidad ?? 0 }));
  const max = Math.max(...filled.map((d) => d.cantidad), 1);
  const W = 600; const H = 100;
  const PAD = { top: 8, right: 10, bottom: 24, left: 28 };
  const chartW = W - PAD.left - PAD.right; const chartH = H - PAD.top - PAD.bottom;
  const pts = filled.map((d, i) => { const x = PAD.left + (i / 23) * chartW; const y = PAD.top + chartH - (d.cantidad / max) * chartH; return `${x},${y}`; });
  const areaPath = [`M ${PAD.left},${PAD.top + chartH}`, ...pts.map((p) => `L ${p}`), `L ${PAD.left + chartW},${PAD.top + chartH}`, "Z"].join(" ");
  const linePath = [`M ${pts[0]}`].concat(pts.slice(1).map((p) => `L ${p}`)).join(" ");
  const LABELS = [0, 6, 12, 18, 23];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs><linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(45,106,79,.45)" /><stop offset="100%" stopColor="rgba(45,106,79,.02)" /></linearGradient></defs>
      <path d={areaPath} fill="url(#hourGrad)" />
      <path d={linePath} fill="none" stroke="rgba(45,106,79,.9)" strokeWidth={1.5} strokeLinejoin="round" />
      {filled.map((d, i) => { if (!LABELS.includes(d.hora)) return null; const x = PAD.left + (i / 23) * chartW; return <text key={d.hora} x={x} y={H - 6} textAnchor="middle" fontSize={8} fill="rgba(139,148,158,.7)">{d.hora}h</text>; })}
    </svg>
  );
}
