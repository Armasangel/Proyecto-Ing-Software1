"use client";

import { COLOR_CUOTA, TEXTO_CUOTA } from "@/lib/constants/cuentas-por-cobrar";
import { fechaCuota } from "@/lib/cuentas-por-cobrar-utils";
import type { Deuda } from "@/lib/types/cuentas-por-cobrar";

export function PlanPagos({ deuda }: { deuda: Deuda }) {
  if (!deuda.cuotas || deuda.cuotas.length === 0) return null;

  return (
    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>
      <div style={{ marginBottom: 4 }}>
        {deuda.numero_factura ? `Factura ${deuda.numero_factura} · ` : ""}
        Crédito a {deuda.plazo_dias} días ·{" "}
        {deuda.cuotas.length === 1 ? "pago único" : `${deuda.cuotas.length} pagos`}
      </div>
      <table
        aria-label={`Plan de pagos de la cuenta ${deuda.id_deuda}`}
        style={{ width: "100%", maxWidth: 560, borderCollapse: "collapse", fontSize: "0.78rem" }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "0.25rem" }}>Pago</th>
            <th style={{ padding: "0.25rem" }}>Vence</th>
            <th style={{ padding: "0.25rem" }}>Monto</th>
            <th style={{ padding: "0.25rem" }}>Pagado</th>
            <th style={{ padding: "0.25rem" }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {deuda.cuotas.map((c) => (
            <tr key={c.numero} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "0.25rem" }}>{c.numero}</td>
              <td style={{ padding: "0.25rem" }}>{fechaCuota(c.fecha_vencimiento)}</td>
              <td style={{ padding: "0.25rem" }}>Q{c.monto.toFixed(2)}</td>
              <td style={{ padding: "0.25rem" }}>Q{c.pagado.toFixed(2)}</td>
              <td style={{ padding: "0.25rem", color: COLOR_CUOTA[c.estado], fontWeight: 600 }}>
                {TEXTO_CUOTA[c.estado]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
