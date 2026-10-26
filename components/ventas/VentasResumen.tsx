import type { VentasController } from "@/hooks/useVentas";

export function VentasResumen({ v }: { v: VentasController }) {
  return (
    <div className="flex justify-between items-center mt-2 pt-4 border-t border-[var(--border)]">
      <div className="flex flex-col">
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
        className="bg-market text-white border-none rounded-control px-6 py-3.5 text-base font-semibold transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Registrar venta
      </button>
    </div>
  );
}
