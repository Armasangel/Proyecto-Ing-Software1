import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/Icon";
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

export function LegendPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
      {color && <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: "0.82rem", color: "var(--muted)", flex: 1 }}>{label}</span>
      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export function StatDescRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ padding: "0.65rem 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
      <div>
        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{label}</div>
        {hint && <div style={{ fontSize: "0.7rem", color: "var(--border)", marginTop: "0.1rem" }}>{hint}</div>}
      </div>
      <div style={{ fontFamily: "var(--font-head)", fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums", textAlign: "right", flexShrink: 0 }}>{value}</div>
    </div>
  );
}
