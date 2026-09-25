"use client";

/* Página unificada de Inventario y Catálogo.
   La barra de tabs vive aquí (7 secciones) y cada vista se mantiene montada,
   alternada con display:none, para no perder búsquedas, filtros ni páginas
   al cambiar de pestaña. */

import { useState } from "react";
import type { CSSProperties } from "react";
import { CatalogoView, type CatalogoTab } from "@/components/inventario-catalogo/CatalogoView";
import { InventarioView, type InventarioTab } from "@/components/inventario-catalogo/InventarioView";

export type InventarioCatalogoTab = CatalogoTab | InventarioTab;

const TABS: ReadonlyArray<readonly [InventarioCatalogoTab, string]> = [
  ["productos", "Productos"],
  ["precios", "Precios"],
  ["stock", "Stock"],
  ["operaciones", "Operaciones"],
  ["kardex", "Kardex"],
  ["bodegas", "Bodegas"],
  ["presentaciones", "Presentaciones"],
];

const ES_CATALOGO = (t: InventarioCatalogoTab): t is CatalogoTab => t === "productos" || t === "precios";

export function InventarioCatalogo({ seccionInicial = "stock" }: { seccionInicial?: InventarioCatalogoTab }) {
  const [tab, setTab] = useState<InventarioCatalogoTab>(seccionInicial);

  const tabCatalogo: CatalogoTab = ES_CATALOGO(tab) ? tab : "productos";
  const tabInventario: InventarioTab = ES_CATALOGO(tab) ? "stock" : tab;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ── Tabs ── */}
      <div style={s.tabRow}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              ...s.tabBtn,
              borderColor: tab === k ? "rgba(45,106,79,.55)" : "var(--border)",
              background: tab === k ? "rgba(45,106,79,.12)" : "transparent",
              color: tab === k ? "var(--text)" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cada vista queda montada; se alterna con display none para conservar
          su estado (búsqueda, filtros, página, modales). */}
      <div style={{ display: ES_CATALOGO(tab) ? undefined : "none" }}>
        <CatalogoView tab={tabCatalogo} />
      </div>
      <div style={{ display: ES_CATALOGO(tab) ? "none" : undefined }}>
        <InventarioView tab={tabInventario} />
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  tabRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" },
  tabBtn: { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", borderRadius: 999, padding: "0.45rem 0.85rem", cursor: "pointer", fontSize: "0.85rem" },
};