"use client";

import { FormularioCliente } from "@/components/clientes/FormularioCliente";
import { PaginationBar } from "@/lib/ui-table";
import { CLS_CPC } from "@/lib/constants/cuentas-por-cobrar";
import { etiquetaTipoCliente } from "@/lib/tipos-cliente";
import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";

export function LimitesTab({ h }: { h: CuentasPorCobrarController }) {
  return (
    <>
      <p className="text-ink-muted mb-4 max-w-[640px]">
        Define el límite de deuda de cada cliente. Al llegar (o superar) ese monto en cuentas por
        cobrar pendientes, el cliente queda bloqueado automáticamente para comprar o hacer pedidos —
        se desbloquea solo cuando su saldo por cobrar vuelve a bajar del límite.
      </p>

      {!h.creandoCliente && (
        <button
          type="button"
          onClick={() => h.setCreandoCliente(true)}
          className="mb-4 px-4 py-[0.4rem] rounded-[14px] bg-success text-white border-none cursor-pointer font-semibold text-[0.85rem]"
        >
          + Nuevo cliente
        </button>
      )}
      {h.creandoCliente && (
        <div className="max-w-[560px]">
          <FormularioCliente
            variant="inline"
            incluirSaldoAnterior
            onCancelar={() => h.setCreandoCliente(false)}
            onCreado={(nuevo, meta) => h.registrarClienteCreado(nuevo, meta, false)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={h.qLimites}
          onChange={(e) => h.setQLimites(e.target.value)}
          placeholder="Buscar cliente por nombre, código, teléfono, correo o NIT…"
          aria-label="Buscar clientes"
          className={`${CLS_CPC.input} flex-[1_1_260px] min-w-[220px] w-auto`}
        />
        <label className="flex items-center gap-[0.4rem] text-[0.85rem] text-ink-muted cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={h.soloBloqueados}
            onChange={(e) => h.setSoloBloqueados(e.target.checked)}
          />
          Solo clientes bloqueados
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b-2 border-line text-left">
              <th className={CLS_CPC.td}>Cliente</th>
              <th className={CLS_CPC.td}>NIT</th>
              <th className={CLS_CPC.td}>Dirección</th>
              <th className={CLS_CPC.td}>Estado</th>
              <th className={CLS_CPC.td}>Saldo por cobrar</th>
              <th className={CLS_CPC.td}>Límite de crédito (Q)</th>
              <th className={CLS_CPC.td}></th>
            </tr>
          </thead>
          <tbody>
            {h.clientesPage.slice.map((c) => (
              <tr key={c.id_cliente} className="border-b border-line">
                <td className={CLS_CPC.td}>
                  {c.nombre}
                  <div className="text-ink-muted text-[0.78rem]">{c.codigo_cliente || "—"}</div>
                  {c.telefono && (
                    <div className="text-ink-muted text-[0.78rem]">{c.telefono}</div>
                  )}
                  {c.tipo_cliente && (
                    <div className="text-ink-muted text-[0.78rem]">
                      {etiquetaTipoCliente(c.tipo_cliente)}
                    </div>
                  )}
                </td>
                <td className={CLS_CPC.td}>{c.nit_cliente || "CF"}</td>
                <td className={CLS_CPC.td}>
                  <div className={c.direccion ? "" : "text-ink-muted"}>{c.direccion || "—"}</div>
                  {c.codigo_postal && (
                    <div className="text-ink-muted text-[0.78rem]">CP {c.codigo_postal}</div>
                  )}
                </td>
                <td className={CLS_CPC.td}>
                  <span
                    className={`font-semibold ${
                      c.estado_cliente ? "text-success" : "text-danger"
                    }`}
                  >
                    {c.estado_cliente ? "Activo" : "Bloqueado"}
                  </span>
                </td>
                <td className={CLS_CPC.td}>Q{h.deudaPendienteDe(c.id_cliente).toFixed(2)}</td>
                <td className={CLS_CPC.td}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Sin límite"
                    className={`${CLS_CPC.input} w-[130px]`}
                    value={h.limitesEditando[c.id_cliente] ?? ""}
                    onChange={(e) =>
                      h.setLimitesEditando((prev) => ({
                        ...prev,
                        [c.id_cliente]: e.target.value,
                      }))
                    }
                  />
                </td>
                <td className={CLS_CPC.td}>
                  <button
                    type="button"
                    onClick={() => h.guardarLimite(c.id_cliente)}
                    disabled={h.guardandoLimiteId === c.id_cliente}
                    className={`px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none text-[0.8rem] ${
                      h.guardandoLimiteId === c.id_cliente ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    {h.guardandoLimiteId === c.id_cliente ? "Guardando…" : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
            {h.clientesPage.slice.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-muted">
                  {h.qLimites.trim() || h.soloBloqueados
                    ? "Ningún resultado para esa búsqueda o filtro."
                    : "No hay clientes registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationBar
          total={h.clientesPage.total}
          page={h.clientesPage.paginaSegura}
          perPage={h.perPage}
          onPage={h.setPage}
          onPerPage={h.setPerPage}
          noun="clientes"
        />
      </div>
    </>
  );
}
