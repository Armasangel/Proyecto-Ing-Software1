"use client";

import type { ReglaPago } from "@/lib/credito";

export function FormPago({
  saldo,
  regla,
  monto,
  setMonto,
  metodo,
  setMetodo,
  error,
  guardando,
  onGuardar,
  onCancelar,
}: {
  saldo: number;
  regla: ReglaPago | null;
  monto: string;
  setMonto: (v: string) => void;
  metodo: string;
  setMetodo: (v: string) => void;
  error: string;
  guardando: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="bg-surface-soft border border-line rounded-[14px] px-4 py-[0.9rem] flex flex-wrap gap-2.5 items-end max-w-[560px]">
      <div className="flex flex-col gap-1">
        <label className="text-[0.75rem] text-ink-muted">
          Monto a abonar (saldo: Q{saldo.toFixed(2)})
        </label>
        <input
          type="number"
          min={regla ? regla.minimo : "0.01"}
          step="0.01"
          max={saldo}
          value={monto}
          readOnly={!!regla?.pagoUnico}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          className="px-[0.6rem] py-[0.4rem] rounded-[10px] border border-line bg-surface w-[130px] text-[0.88rem]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[0.75rem] text-ink-muted">Método</label>
        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="px-[0.6rem] py-[0.4rem] rounded-[10px] border border-line bg-surface text-[0.88rem]"
        >
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="TARJETA">Tarjeta</option>
        </select>
      </div>
      {regla && (
        <p style={{ flexBasis: "100%", margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
          {regla.pagoUnico
            ? `Pago único: se debe pagar completo (Q${regla.minimo.toFixed(2)}).`
            : `Pago ${regla.cuota?.numero} de ${regla.totalCuotas}: mínimo Q${regla.minimo.toFixed(
                2
              )}. Puedes pagar más y las cuotas siguientes se recalculan con lo que sobre.`}
        </p>
      )}
      {!regla?.pagoUnico && (
        <button
          type="button"
          onClick={() => setMonto(saldo.toFixed(2))}
          className="px-[0.7rem] py-[0.4rem] rounded-[10px] border border-market bg-transparent text-[var(--accent2)] text-[0.78rem] cursor-pointer"
        >
          Abonar todo
        </button>
      )}
      <button
        type="button"
        onClick={onGuardar}
        disabled={guardando}
        className={`px-4 py-[0.45rem] rounded-[10px] border-none bg-market text-black text-[0.85rem] font-semibold ${
          guardando ? "cursor-default opacity-70" : "cursor-pointer"
        }`}
      >
        {guardando ? "Guardando…" : "Guardar pago"}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="px-[0.9rem] py-[0.45rem] rounded-[10px] border border-line bg-transparent text-ink-muted text-[0.85rem] cursor-pointer"
      >
        Cancelar
      </button>
      {error && <div className="w-full text-danger text-[0.8rem]">{error}</div>}
    </div>
  );
}
