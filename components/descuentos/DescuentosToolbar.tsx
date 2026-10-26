"use client";

import { BTN_PRIMARY_DESCUENTO } from "@/lib/constants/descuentos";
import type { useDescuentos } from "@/hooks/useDescuentos";

export function DescuentosToolbar({ h }: { h: ReturnType<typeof useDescuentos> }) {
  if (h.formularioAbierto) return null;
  return (
    <div className="mb-6">
      <button onClick={h.abrirNuevo} className={BTN_PRIMARY_DESCUENTO}>
        + Nuevo descuento
      </button>
    </div>
  );
}
