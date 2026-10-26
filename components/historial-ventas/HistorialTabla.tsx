import { HISTORIAL_VENTAS_CLS } from "@/lib/constants/historial-ventas";
import { estadoClass, num, resumenLineas } from "@/lib/historial-ventas-utils";
import type { HistorialVentasController } from "@/hooks/useHistorialVentas";

export function HistorialTabla({ h }: { h: HistorialVentasController }) {
  return (
    <div className={HISTORIAL_VENTAS_CLS.tableWrapper}>
      <table className={HISTORIAL_VENTAS_CLS.table}>
        <thead>
          <tr>
            <th className={HISTORIAL_VENTAS_CLS.th}>#</th>
            <th className={HISTORIAL_VENTAS_CLS.th}>Fecha</th>
            <th className={HISTORIAL_VENTAS_CLS.th}>Cliente</th>
            <th className={HISTORIAL_VENTAS_CLS.th}>Resumen</th>
            <th className={`${HISTORIAL_VENTAS_CLS.th} text-right`}>Total</th>
            <th className={HISTORIAL_VENTAS_CLS.th}>Estado</th>
            <th className={HISTORIAL_VENTAS_CLS.th}>Tipo</th>
            <th className={HISTORIAL_VENTAS_CLS.th}>Colaborador</th>
          </tr>
        </thead>
        <tbody>
          {h.cargando && h.ventas.length === 0 ? (
            <tr>
              <td colSpan={8} className={`${HISTORIAL_VENTAS_CLS.td} text-center text-ink-muted`}>
                Cargando…
              </td>
            </tr>
          ) : h.ventas.length === 0 ? (
            <tr>
              <td colSpan={8} className={`${HISTORIAL_VENTAS_CLS.td} text-center text-ink-muted`}>
                No hay ventas con los filtros actuales.
              </td>
            </tr>
          ) : (
            h.ventas.map((v) => (
              <tr key={v.id_venta} className="border-b border-line">
                <td className={HISTORIAL_VENTAS_CLS.td}>
                  <code className={HISTORIAL_VENTAS_CLS.code}>{v.id_venta}</code>
                </td>
                <td className={`${HISTORIAL_VENTAS_CLS.td} text-ink-muted whitespace-nowrap`}>
                  {new Date(v.fecha_venta).toLocaleString("es-GT", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className={HISTORIAL_VENTAS_CLS.td}>
                  <div className="font-medium">{v.nombre_cliente}</div>
                  <div className="text-[0.78rem] text-ink-muted">
                    {v.codigo_cliente ? `${v.codigo_cliente} · ` : ""}
                    {v.correo_cliente}
                  </div>
                </td>
                <td className={`${HISTORIAL_VENTAS_CLS.td} max-w-[220px]`}>{resumenLineas(v)}</td>
                <td className={`${HISTORIAL_VENTAS_CLS.td} text-right font-semibold`}>Q{num(v.total).toFixed(2)}</td>
                <td className={HISTORIAL_VENTAS_CLS.td}>
                  <span className={`${HISTORIAL_VENTAS_CLS.badgeEstado} ${estadoClass(v.estado_venta)}`}>{v.estado_venta}</span>
                </td>
                <td className={HISTORIAL_VENTAS_CLS.td}>
                  <span className="text-[0.8rem] text-ink-muted">{v.tipo_venta}</span>
                  {v.enlinea ? <span className={`${HISTORIAL_VENTAS_CLS.tag} ml-1.5`}>En línea</span> : null}
                </td>
                <td className={`${HISTORIAL_VENTAS_CLS.td} text-ink-muted`}>{v.nombre_colaborador ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
