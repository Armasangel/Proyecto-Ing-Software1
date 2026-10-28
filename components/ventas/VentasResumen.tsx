import type { VentasController } from "@/hooks/useVentas";

export function VentasResumen({ v }: { v: VentasController }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
      <div className="flex min-w-0 flex-col">
        <span className="font-bold text-ink">Total: Q{v.totalBorrador.toFixed(2)}</span>
        {v.descuentoBorrador > 0 && (
          <span className="text-[0.8rem] text-market-600 font-medium">
            Subtotal Q{v.totalBrutoBorrador.toFixed(2)} · Descuento −Q{v.descuentoBorrador.toFixed(2)}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => v.setConfirmando(true)}
        disabled={v.loadingSubmit || !v.puedeEnviar}
        className="w-full rounded-control border-none bg-market px-6 py-3.5 text-base font-semibold text-white transition-transform hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        Registrar venta
      </button>
    </div>
  );
}
