import { q, type PuntoIngresos } from "./utils";

export function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 100, color: "var(--muted)", fontSize: "0.82rem" }}>
      {label}
    </div>
  );
}

export function BarChart({ puntos, height = 190 }: { puntos: PuntoIngresos[]; height?: number }) {
  if (puntos.length === 0) return <EmptyChart label="Sin datos en el periodo" />;
  const max = Math.max(...puntos.map((p) => p.total), 1);
  const W = 600; const H = height;
  const PAD = { top: 12, right: 10, bottom: 30, left: 58 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const slot = chartW / puntos.length;
  const barW = Math.min(44, slot * 0.7);
  const TICKS = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => Math.round((max / TICKS) * i));
  const step = Math.ceil(puntos.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos en el periodo" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {yTicks.map((tick) => {
        const y = PAD.top + chartH - (tick / max) * chartH;
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} strokeWidth={1} strokeDasharray="4 4" style={{ stroke: "var(--border)" }} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={12} style={{ fill: "var(--muted)" }}>{tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}</text>
          </g>
        );
      })}
      {puntos.map((p, i) => {
        const x = PAD.left + i * slot + (slot - barW) / 2;
        const barH = Math.max(2, (p.total / max) * chartH);
        const y = PAD.top + chartH - barH;
        return (
          <g key={p.clave}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} style={{ fill: "var(--accent)" }} opacity={0.85}>
              <title>{`${p.titulo}: ${q(p.total)} · ${p.cantidad} venta${p.cantidad !== 1 ? "s" : ""}`}</title>
            </rect>
            {i % step === 0 && <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={12} style={{ fill: "var(--muted)" }}>{p.etiqueta}</text>}
          </g>
        );
      })}
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
