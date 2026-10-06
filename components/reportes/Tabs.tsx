"use client";

import { s } from "./styles";

export type TabDef<K extends string> = { key: K; label: string };

export const tabId = (key: string) => `reportes-tab-${key}`;
export const panelId = (key: string) => `reportes-panel-${key}`;

export function Tabs<K extends string>({ tabs, active, onChange }: { tabs: TabDef<K>[]; active: K; onChange: (key: K) => void }) {
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    document.getElementById(tabId(tabs[next].key))?.focus();
  }

  return (
    <div role="tablist" aria-label="Secciones del reporte" style={s.tabBar}>
      {tabs.map((t, i) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={tabId(t.key)}
            aria-selected={selected}
            aria-controls={panelId(t.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{ ...s.tab, color: selected ? "var(--text)" : "var(--muted)", borderBottomColor: selected ? "var(--accent)" : "transparent" }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
