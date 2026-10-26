"use client";

import { TABS_BODEGA } from "@/lib/constants/bodega";
import { s } from "@/lib/styles/bodega";
import type { useBodega } from "@/hooks/useBodega";

export function BodegaTabs({ h }: { h: ReturnType<typeof useBodega> }) {
  return (
    <div style={s.tabs}>
      {TABS_BODEGA.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => h.cambiarTab(tab.key)}
          style={{
            ...s.tabBtn,
            borderColor: h.tab === tab.key ? "var(--accent2)" : "var(--border)",
            background: h.tab === tab.key ? "rgba(34,197,94,.12)" : "var(--surface)",
            color: h.tab === tab.key ? "var(--text)" : "var(--muted)",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
