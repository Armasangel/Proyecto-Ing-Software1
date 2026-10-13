"use client";

import type { CSSProperties } from "react";
import { sanitizeCantidad, stepCantidad } from "@/lib/cantidad";

/* Campo de cantidad con botones − / + que suben y bajan en medios.
 *
 * El input es type="text" + inputMode="decimal" a propósito: con
 * type="number" el navegador usa `min` como base del `step`, y por eso el
 * botón de aumento arrancaba en 0.001. Aquí el aumento lo manejan estos
 * botones y lib/cantidad es lo que impide que entre cualquier otra cosa.
 *
 * El input recibe su aspecto del que lo usa (className de Tailwind en
 * /ventas, style en línea en el resto); los botones usan las mismas variables
 * CSS para verse igual en todas las pantallas.
 */
type Props = {
  value: string;
  onChange: (valor: string) => void;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
  /** Para las pantallas donde el campo va dentro de una fila y necesita
   *  reservar su propio ancho. */
  containerStyle?: CSSProperties;
};

export function CantidadInput({ value, onChange, ariaLabel, className, style, containerStyle }: Props) {
  return (
    <div style={{ ...container, ...containerStyle }}>
      <button
        type="button"
        style={btn}
        onClick={() => onChange(stepCantidad(value, -1))}
        aria-label={`Disminuir ${ariaLabel.toLowerCase()}`}
        title="Disminuir 0.5"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={className}
        style={{ ...style, flex: 1, minWidth: 0 }}
        value={value}
        onChange={(e) => onChange(sanitizeCantidad(e.target.value))}
      />
      <button
        type="button"
        style={btn}
        onClick={() => onChange(stepCantidad(value, 1))}
        aria-label={`Aumentar ${ariaLabel.toLowerCase()}`}
        title="Aumentar 0.5"
      >
        +
      </button>
    </div>
  );
}

const container: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.25rem",
  minWidth: 0,
};

const btn: CSSProperties = {
  flex: "0 0 auto",
  width: 30,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: "1rem",
  lineHeight: 1,
};
