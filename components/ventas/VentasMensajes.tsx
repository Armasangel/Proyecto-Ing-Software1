import { formatoFecha } from "@/lib/ventas-utils";
import type { VentasController } from "@/hooks/useVentas";

export function VentasMensajes({ v }: { v: VentasController }) {
  return (
    <>
      {v.error && (
        <div className="mt-4 bg-achiote-50 border border-achiote/30 rounded-control px-4 py-3 text-achiote-600">
          {v.error}
        </div>
      )}
      {v.okMsg && v.ventaDeshacer && (
        <div key={v.okMsg} className="mt-4 bg-market-50 border border-market/35 rounded-control px-4 py-3 text-market-600 font-medium flex items-center gap-3 flex-wrap animate-stamp">
          <span className="inline-flex w-5 h-5 rounded-full bg-market text-white items-center justify-center text-xs shrink-0">✓</span>
          <span className="flex-1">
            {v.okMsg}
            {v.creditoGenerado && (
              <>
                {" "}· vence {formatoFecha(v.creditoGenerado.fecha_limite_pago)}.
                {v.creditoGenerado.bloqueado && (
                  <span className="block text-achiote-600 font-semibold mt-1">
                    ⚠️ Este cliente alcanzó su límite de crédito y quedó bloqueado para nuevas compras.
                  </span>
                )}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={v.handleDeshacer}
            disabled={v.deshaciendo}
            className="bg-transparent border border-market text-market-600 rounded-control px-3 py-1.5 text-[0.85rem] font-semibold transition-transform active:scale-[0.97] hover:bg-market disabled:opacity-60 disabled:cursor-not-allowed hover:text-white"
          >
            {v.deshaciendo ? "Deshaciendo…" : `Deshacer (${v.segundosRestantes}s)`}
          </button>
        </div>
      )}
    </>
  );
}
