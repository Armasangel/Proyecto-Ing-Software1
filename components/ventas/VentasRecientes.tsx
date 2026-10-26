import { ESTADOS_PEDIDO } from "@/lib/constants/ventas";
import type { VentasController } from "@/hooks/useVentas";

export function VentasRecientes({ v }: { v: VentasController }) {
  return (
    <div>
      <h2 className="font-head text-[1.15rem] mb-4 text-market-600">Ventas recientes</h2>
      {v.loadingLista ? (
        <p className="text-ink-muted">Cargando historial…</p>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
          <table className="w-full border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-market">
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">#</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Fecha</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Cliente</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Colaborador</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado pago</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Tipo</th>
                <th className="px-3.5 py-2.5 text-right text-[0.82rem] font-semibold text-white">Total</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Productos</th>
              </tr>
            </thead>
            <tbody>
              {v.ventas.map((venta, i) => (
                <tr key={venta.id_venta} className={`align-top ${i % 2 === 0 ? "bg-cream/40" : "bg-white"}`}>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{venta.id_venta}</td>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{new Date(venta.fecha_venta).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">
                    <div className="font-medium">{venta.nombre_cliente}</div>
                    <div className="text-[0.78rem] text-ink-muted">
                      {venta.codigo_cliente ? `${venta.codigo_cliente} · ` : ""}
                      {venta.correo_cliente}
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{venta.nombre_colaborador ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">
                    {venta.condicion_pago === "CREDITO" ? `Crédito · ${venta.estado_venta}` : venta.estado_venta}
                    {venta.id_orden && venta.estado_pedido && (
                      <span className="block text-[0.75rem] text-ink-muted">Pedido: {ESTADOS_PEDIDO[venta.estado_pedido] ?? venta.estado_pedido}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{venta.tipo_venta}</td>
                  <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)] text-right font-semibold">Q{Number(venta.total).toFixed(2)}</td>
                  <td className="px-3.5 py-2.5 text-[0.82rem] border-b border-[var(--border)] max-w-[320px]">
                    {(venta.productos || []).map((pr) => (
                      <div key={pr.id_detalle} className="mb-1.5">
                        <span className="text-ink">{pr.codigo_producto}</span>{" "}× {Number(pr.cantidad).toFixed(3)} @ Q{Number(pr.precio_unitario_venta).toFixed(2)} → Q{Number(pr.subtotal).toFixed(2)}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.ventas.length === 0 && <p className="p-5 text-ink-muted m-0">Aún no hay ventas registradas.</p>}
        </div>
      )}
    </div>
  );
}
