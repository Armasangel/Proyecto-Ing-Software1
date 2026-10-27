import { etiquetaTipoDocumento } from "@/lib/tipos-documento";
import { formatoFecha } from "@/lib/ventas-utils";
import type { VentasController } from "@/hooks/useVentas";

export function ConfirmarVentaModal({ v }: { v: VentasController }) {
  if (!v.confirmando) return null;

  return (
    <div
      className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4"
      onClick={() => v.setConfirmando(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-card bg-white p-6 shadow-warm-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-head text-lg font-bold text-ink mb-2">¿Confirmar esta venta?</h3>
        <p className="text-ink-muted text-[0.9rem] mb-4">
          {v.clienteSeleccionado?.nombre ?? "Cliente"} ·{" "}
          {v.lineas.filter((l) => l.id_producto).length} producto(s) · Total: Q{v.totalBorrador.toFixed(2)}
        </p>
        {v.condicionPago === "CREDITO" ? (
          <p className="text-ink text-[0.88rem] mb-4 bg-market-50 border border-market/30 rounded-control px-3 py-2">
            <strong>A crédito</strong> · {etiquetaTipoDocumento(v.tipoDocumentoCredito).toLowerCase()} del {formatoFecha(v.fechaFacturaEfectiva)} · plazo de {v.plazoDias} días ·{" "}
            {Number(v.numeroCuotas) === 1 ? "pago único" : `${v.numeroCuotas} pagos`}. Se generará la factura y una cuenta por cobrar.
          </p>
        ) : (
          <p className="text-ink-muted text-[0.88rem] mb-4">De contado: el cliente paga el total ahora.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => v.setConfirmando(false)}
            className="px-4 py-2 rounded-control border border-[var(--border)] text-ink-muted text-sm font-medium hover:bg-cream"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={v.handleSubmit}
            disabled={v.loadingSubmit}
            className="px-4 py-2 rounded-control bg-market text-white text-sm font-semibold transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-70"
          >
            {v.loadingSubmit ? "Guardando…" : "Sí, registrar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
