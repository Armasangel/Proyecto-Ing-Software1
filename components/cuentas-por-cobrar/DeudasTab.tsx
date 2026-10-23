"use client";

import { Fragment } from "react";
import { matchesQuery } from "@/lib/ui-table";
import { cumpleFiltroVencimiento } from "@/lib/cuentas-por-cobrar-utils";
import { reglaDePago, type ReglaPago } from "@/lib/credito";
import { etiquetaTipoCliente } from "@/lib/tipos-cliente";
import { CLS_CPC } from "@/lib/constants/cuentas-por-cobrar";
import { diasRestantes } from "@/lib/cuentas-por-cobrar-utils";
import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";
import type { Deuda } from "@/lib/types/cuentas-por-cobrar";

function cumple(d: Deuda, f: string) {
  if (!f) return true;
  return matchesQuery(f, d.nombre_deudor, d.telefono_deudor, d.numero_factura);
}

export function DeudasTab({ h }: { h: CuentasPorCobrarController }) {
  const filtradas = h.deudas
    .filter((d) => cumple(d, h.qDeudas))
    .filter((d) => cumpleFiltroVencimiento(d.fecha_limite_pago, h.filtroVencimiento));

  const gruposFiltrados = h.grupos.filter((g) => {
    if (!h.qDeudas) return true;
    return matchesQuery(h.qDeudas, g.nombre, g.telefono);
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          type="search"
          placeholder="Buscar por cliente, teléfono o factura..."
          value={h.qDeudas}
          onChange={(e) => h.setQDeudas(e.target.value)}
          className={`${CLS_CPC.input} w-full max-w-[320px]`}
        />
        <select
          value={h.filtroVencimiento}
          onChange={(e) => h.setFiltroVencimiento(e.target.value as any)}
          className={CLS_CPC.input}
        >
          <option value="todas">Todas</option>
          <option value="vencidas">Vencidas</option>
          <option value="proximas">Próximas a vencer (≤3 días)</option>
          <option value="sin_fecha">Sin fecha límite</option>
        </select>
      </div>
      {h.vista === "acumulado" && (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead>
              <tr>
                <th className={`text-left ${CLS_CPC.td}`}>Cliente</th>
                <th className={`text-left ${CLS_CPC.td}`}>Teléfono</th>
                <th className={`text-left ${CLS_CPC.td}`}>Deudas pendientes</th>
                <th className={`text-left ${CLS_CPC.td}`}>Saldo pendiente</th>
                <th className={`text-left ${CLS_CPC.td}`}>Vencimiento más cercano</th>
                <th className={`text-left ${CLS_CPC.td}`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gruposFiltrados.map((g) => (
                <tr key={g.key} className="border-t border-line">
                  <td className={CLS_CPC.td}>
                    <div className="font-semibold">{g.nombre}</div>
                    {g.cliente?.tipo_cliente && (
                      <div className="text-[0.75rem] text-ink-muted">{etiquetaTipoCliente(g.cliente.tipo_cliente)}</div>
                    )}
                  </td>
                  <td className={CLS_CPC.td}>{g.telefono || "—"}</td>
                  <td className={CLS_CPC.td}>{g.deudas.filter((d) => d.estado_deuda === "PENDIENTE").length}</td>
                  <td className={CLS_CPC.td}>Q{g.saldoPendiente.toFixed(2)}</td>
                  <td className={CLS_CPC.td}>
                    <span className={diasRestantes(g.fechaLimiteMasCercana).cls}>
                      {diasRestantes(g.fechaLimiteMasCercana).texto}
                    </span>
                  </td>
                  <td className={CLS_CPC.td}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {h.vista === "vencimiento" && (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead>
              <tr>
                <th className={`text-left ${CLS_CPC.td}`}>Cliente</th>
                <th className={`text-left ${CLS_CPC.td}`}>Factura</th>
                <th className={`text-left ${CLS_CPC.td}`}>Monto</th>
                <th className={`text-left ${CLS_CPC.td}`}>Saldo</th>
                <th className={`text-left ${CLS_CPC.td}`}>Límite</th>
                <th className={`text-left ${CLS_CPC.td}`}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => (
                <tr key={d.id_deuda} className="border-t border-line">
                  <td className={CLS_CPC.td}>{d.nombre_deudor}</td>
                  <td className={CLS_CPC.td}>{d.numero_factura || "—"}</td>
                  <td className={CLS_CPC.td}>Q{Number(d.monto_total).toFixed(2)}</td>
                  <td className={CLS_CPC.td}>Q{Number(d.saldo_pendiente).toFixed(2)}</td>
                  <td className={CLS_CPC.td}>
                    <span className={diasRestantes(d.fecha_limite_pago).cls}>
                      {diasRestantes(d.fecha_limite_pago).texto}
                    </span>
                  </td>
                  <td className={CLS_CPC.td}>{d.estado_deuda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
