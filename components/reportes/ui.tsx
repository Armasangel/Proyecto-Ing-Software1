import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { EmptyChart } from "./charts";
import { s } from "./styles";

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 99, background: up ? "rgba(63,185,80,.12)" : "rgba(248,81,73,.12)", color: up ? "var(--green)" : "var(--red)", border: `1px solid ${up ? "rgba(63,185,80,.3)" : "rgba(248,81,73,.3)"}` }}>
      {up ? "↑" : "↓"} {Math.abs(delta)}%
    </span>
  );
}

export function StatCard({ label, value, sub, icon, delta }: { label: string; value: string; sub?: string; icon: IconName; delta?: number | null }) {
  return (
    <div style={s.statCard}>
      <div style={s.statCardTop}>
        <div style={s.statIconWrap}>
          <Icon name={icon} variant="dark" size={18} />
        </div>
        <span style={s.statLabel}>{label}</span>
      </div>
      <div style={s.statValue}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
        {sub && <span style={s.statSub}>{sub}</span>}
        {delta !== undefined && <DeltaBadge delta={delta ?? null} />}
      </div>
    </div>
  );
}

export function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...s.card, ...style }}>
      {title && <h3 style={s.cardTitle}>{title}</h3>}
      {children}
    </div>
  );
}

/** Tarjeta con un porcentaje grande y una barra de progreso. */
export function ProgressCard({ label, value, pct, sub, icon }: { label: string; value: string; pct: number; sub?: string; icon: IconName }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={s.statCard}>
      <div style={s.statCardTop}>
        <div style={s.statIconWrap}>
          <Icon name={icon} variant="dark" size={18} />
        </div>
        <span style={s.statLabel}>{label}</span>
      </div>
      <div style={s.statValue}>{value}</div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w} style={s.progressTrack}>
        <div style={{ ...s.progressFill, width: `${w}%` }} />
      </div>
      {sub && <div style={{ ...s.statSub, marginTop: "0.45rem" }}>{sub}</div>}
    </div>
  );
}

export type SplitSegment = { label: string; value: number; color: string; detail?: string };

/** Una sola barra dividida en partes, con su porcentaje debajo. Reemplaza a las gráficas de pastel. */
export function SplitBar({ segments }: { segments: SplitSegment[] }) {
  const total = segments.reduce((sum, sg) => sum + sg.value, 0);
  if (total === 0) return <EmptyChart label="Sin datos" />;
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 99, overflow: "hidden", background: "var(--surface2)" }}>
        {segments.filter((sg) => sg.value > 0).map((sg) => (
          <div key={sg.label} title={`${sg.label}: ${Math.round((sg.value / total) * 100)}%`} style={{ width: `${(sg.value / total) * 100}%`, background: sg.color }} />
        ))}
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        {segments.map((sg) => (
          <div key={sg.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: sg.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", flex: 1 }}>{sg.label}{sg.detail ? ` · ${sg.detail}` : ""}</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{Math.round((sg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Contadores sencillos: un número grande con su etiqueta y un punto de color. */
export function CounterGrid({ items }: { items: { label: string; value: number; color: string }[] }) {
  if (items.length === 0) return <EmptyChart label="Sin datos" />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem" }}>
      {items.map((it) => (
        <div key={it.label} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.65rem 0.8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.74rem", color: "var(--muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: it.color, flexShrink: 0 }} />
            {it.label}
          </div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", marginTop: "0.15rem", fontVariantNumeric: "tabular-nums" }}>
            {it.value.toLocaleString("es-GT")}
          </div>
        </div>
      ))}
    </div>
  );
}
