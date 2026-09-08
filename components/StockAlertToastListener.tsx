"use client";

/* StockAlertToastListener
   Muestra un toast cuando un producto cruza por debajo de su stock mínimo,
   sin importar en qué página del panel esté el dueño. Recibe las alertas
   "nuevas" ya calculadas por useStockAlertas (no hace su propio fetch),
   para que el sidebar y los toasts compartan una sola fuente de polling. */

import { useEffect } from "react";
import type { StockAlerta } from "@/hooks/useStockAlertas";

const TOAST_DURATION_MS = 8000;

type Props = {
  nuevas: StockAlerta[];
  onDescartar: (idProducto: number) => void;
};

export function StockAlertToastListener({ nuevas, onDescartar }: Props) {
  useEffect(() => {
    if (nuevas.length === 0) return;
    const timers = nuevas.map((a) =>
      setTimeout(() => onDescartar(a.id_producto), TOAST_DURATION_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [nuevas, onDescartar]);

  if (nuevas.length === 0) return null;

  return (
    <div style={s.container}>
      {nuevas.map((a) => (
        <div key={`${a.id_producto}-${a.id_bodega}`} style={s.toast}>
          <div style={s.icon}>⚠️</div>
          <div>
            <div style={s.title}>Stock bajo</div>
            <div style={s.body}>
              <strong>{a.nombre_producto}</strong> en {a.nombre_bodega}:{" "}
              {a.cantidad_disponible} {a.unidad_medida} (mínimo {a.stock_minimo})
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "2rem",
    right: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    zIndex: 400,
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.6rem",
    padding: "0.85rem 1.1rem",
    borderRadius: "var(--radius, 10px)",
    background: "rgba(232,160,69,.15)",
    border: "1px solid rgba(232,160,69,.4)",
    backdropFilter: "blur(8px)",
    boxShadow: "var(--shadow, 0 4px 16px rgba(0,0,0,.25))",
    maxWidth: 320,
  },
  icon: {
    fontSize: "1.1rem",
    lineHeight: 1,
  },
  title: {
    fontWeight: 700,
    fontSize: "0.85rem",
    color: "var(--accent)",
    marginBottom: "0.15rem",
  },
  body: {
    fontSize: "0.85rem",
    color: "var(--fg, #e6e6e6)",
  },
};
