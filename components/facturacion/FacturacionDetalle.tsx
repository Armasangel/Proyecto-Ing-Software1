"use client";

import { etiquetaTipoDocumento } from "@/lib/tipos-documento";
import type { FacturaDetalle } from "@/lib/types/facturacion";

export function FacturacionDetalle({
  factura,
  onCerrar,
}: {
  factura: FacturaDetalle;
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de factura"
    >
      <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-card bg-white shadow-warm p-7">
        <div id="factura-print-area">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-ink">
                {etiquetaTipoDocumento(factura.tipo_documento || "FACTURA")} {factura.numero_factura}
              </h2>
              <p className="text-ink-muted text-sm">
                {new Date(factura.fecha_venta).toLocaleDateString("es-GT")}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-market-50 text-market-600">
              {factura.estado_venta}
            </span>
          </div>

          <div className="mb-5 text-sm">
            <p className="text-ink">
              <span className="font-semibold">Cliente:</span> {factura.nombre_cliente}
            </p>
            {factura.codigo_cliente && (
              <p className="text-ink-muted">Código: {factura.codigo_cliente}</p>
            )}
            <p className="text-ink-muted">NIT: {factura.nit_cliente}</p>
            {factura.direccion_cliente && (
              <p className="text-ink-muted">Dirección: {factura.direccion_cliente}</p>
            )}
            <p className="text-ink-muted">{factura.correo}</p>
          </div>

          <table className="w-full border-collapse text-[0.85rem] mb-4">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-1.5 text-left text-ink-muted font-semibold">Producto</th>
                <th className="py-1.5 text-right text-ink-muted font-semibold">Cant.</th>
                <th className="py-1.5 text-right text-ink-muted font-semibold">P. unit.</th>
                <th className="py-1.5 text-right text-ink-muted font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {factura.productos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-ink-muted">
                    Sin productos registrados.
                  </td>
                </tr>
              ) : (
                factura.productos.map((p) => (
                  <tr key={p.id_detalle} className="border-b border-[var(--border)]">
                    <td className="py-1.5 text-ink">{p.nombre_producto}</td>
                    <td className="py-1.5 text-right text-ink-muted">{p.cantidad}</td>
                    <td className="py-1.5 text-right text-ink-muted">
                      Q{Number(p.precio_unitario).toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right text-ink">Q{Number(p.subtotal).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex justify-end">
            <p className="text-base font-bold text-ink">
              Total: Q{Number(factura.total_factura).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="no-print flex justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2 rounded-control bg-cream/60 text-ink border border-[var(--border)] text-sm font-medium hover:brightness-95"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-control bg-market text-white border-none text-sm font-medium hover:brightness-110"
          >
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
