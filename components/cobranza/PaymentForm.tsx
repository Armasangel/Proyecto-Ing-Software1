"use client";

import type { Deudor } from "./types";
import { formatQuetzales } from "./format";

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;

type Props = {
  deudor: Deudor;
  monto: string;
  metodo: (typeof METODOS)[number];
  guardando: boolean;
  onMontoChange: (v: string) => void;
  onMetodoChange: (v: (typeof METODOS)[number]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
};

const inputStyle: React.CSSProperties = {
  padding: "0.45rem 0.6rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
};

export function PaymentForm({
  deudor,
  monto,
  metodo,
  guardando,
  onMontoChange,
  onMetodoChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginBottom: "1.5rem",
        padding: "1rem",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        maxWidth: 420,
      }}
    >
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
        Registrar pago — venta #{deudor.id_venta}
      </h3>
      <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.85rem" }}>
        {deudor.nombre_cliente} · pendiente Q{formatQuetzales(deudor.deuda_pendiente)}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <label style={{ fontSize: "0.82rem" }}>
          Monto (Q)
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={monto}
            onChange={(e) => onMontoChange(e.target.value)}
            style={{ ...inputStyle, width: "100%", marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: "0.82rem" }}>
          Método
          <select
            value={metodo}
            onChange={(e) =>
              onMetodoChange(e.target.value as (typeof METODOS)[number])
            }
            style={{ ...inputStyle, width: "100%", marginTop: 4 }}
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button
            type="submit"
            disabled={guardando}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 6,
              border: "none",
              background: "#2d6a4f",
              color: "#fff",
              cursor: guardando ? "wait" : "pointer",
            }}
          >
            {guardando ? "Guardando…" : "Registrar pago"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}

export { METODOS };
