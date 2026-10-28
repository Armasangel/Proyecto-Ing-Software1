"use client";

import type { Deuda } from "@/lib/types/cuentas-por-cobrar";

export function SaldoCubierto({ d }: { d: Deuda }) {
  const pct = Math.max(0, Math.min(100, Number(d.porcentaje_cubierto) || 0));
  const saldo = Number(d.saldo_pendiente);
  if (d.estado_deuda === "PAGADA") {
    return <span className="text-success font-semibold text-[0.82rem]">Cubierto al 100%</span>;
  }
  return (
    <div>
      <div className="text-[0.8rem] mb-[3px]">
        <strong>Q{saldo.toFixed(2)}</strong>
        <span className="text-ink-muted"> pendiente · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-line overflow-hidden">
        <div
          className="h-full rounded-full bg-market transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
