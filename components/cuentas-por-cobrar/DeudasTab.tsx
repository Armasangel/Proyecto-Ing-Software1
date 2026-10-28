"use client";

import { Fragment } from "react";
import { ClienteAutocompletar } from "@/components/ClienteAutocompletar";
import { FormularioCliente } from "@/components/clientes/FormularioCliente";
import { PaginationBar } from "@/components/pagination/PaginationBar";
import { CLS_CPC, tabPillClass } from "@/lib/constants/cuentas-por-cobrar";
import { diasRestantes } from "@/lib/cuentas-por-cobrar-utils";
import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";
import { FormPago } from "./FormPago";
import { PlanPagos } from "./PlanPagos";
import { SaldoCubierto } from "./SaldoCubierto";

export function DeudasTab({ h }: { h: CuentasPorCobrarController }) {
  return (
    <>
      <div
        style={{
          marginBottom: "1.25rem",
          padding: "0.8rem 1rem",
          border: "1px solid var(--border)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ flex: 1, minWidth: 240, fontSize: "0.88rem", color: "var(--muted)" }}>
          Las ventas a crédito se registran desde{" "}
          <strong style={{ color: "var(--text)" }}>Ventas</strong> (en el menú): ahí se elige
          Crédito, la fecha de la factura, el plazo y los pagos, y se genera la factura y la cuenta
          por cobrar automáticamente.
        </span>
      </div>

      {!h.creando && (
        <button
          type="button"
          onClick={() => {
            h.setCreando(true);
            h.setMensaje("");
            h.setError("");
          }}
          className="mb-6 px-[1.2rem] py-2 rounded-[14px] bg-success text-white border-none cursor-pointer font-semibold"
        >
          + Saldo anterior (sin venta)
        </button>
      )}

      {h.creando && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: 14,
            maxWidth: 600,
          }}
        >
          <h3 style={{ marginBottom: "0.25rem" }}>Saldo anterior (sin venta)</h3>
          <p style={{ marginBottom: "1rem", fontSize: "0.8rem", color: "var(--muted)" }}>
            Para registrar lo que un cliente ya debía antes de usar el sistema. Las ventas nuevas a
            crédito se registran desde Ventas.
          </p>

          <div className="mb-3">
            <label className="block mb-1 text-[0.85rem]">Cliente *</label>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-0 flex-1 isolate">
                <ClienteAutocompletar
                  clientes={h.clientes}
                  value={h.form.id_cliente}
                  onChange={(id) => h.setForm((f) => ({ ...f, id_cliente: id }))}
                  onSelect={h.seleccionarCliente}
                  placeholder="Buscar cliente por código, nombre, NIT o teléfono…"
                  ariaLabel="Buscar cliente"
                  className={`${CLS_CPC.input} w-full`}
                  mensajeVacio="Escribe el código o el nombre para buscar"
                />
              </div>
              <button
                type="button"
                onClick={() => h.setCreandoCliente((v) => !v)}
                className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none cursor-pointer text-[0.8rem] whitespace-nowrap"
              >
                + Cliente nuevo
              </button>
            </div>
            <p className="text-[0.78rem] text-ink-muted mt-1">
              Toda cuenta por cobrar queda asociada a un cliente registrado; si supera su límite, se
              le bloquean compras y pedidos.
            </p>

            {h.creandoCliente && (
              <FormularioCliente
                variant="inline"
                incluirSaldoAnterior
                className="my-2"
                onCancelar={() => h.setCreandoCliente(false)}
                onCreado={h.registrarClienteCreado}
              />
            )}

            {h.clienteSeleccionado && (
              <p className="text-[0.82rem] mt-1">
                <strong className="font-semibold">
                  {h.clienteSeleccionado.codigo_cliente || "—"}
                </strong>
                {h.clienteSeleccionado.nit_cliente && (
                  <> · NIT {h.clienteSeleccionado.nit_cliente}</>
                )}
                {h.clienteSeleccionado.direccion && <> · {h.clienteSeleccionado.direccion}</>}
                {h.clienteSeleccionado.telefono && <> · Tel: {h.clienteSeleccionado.telefono}</>}
                <> · Saldo por cobrar actual: Q{h.deudaPendienteDe(h.clienteSeleccionado.id_cliente).toFixed(2)}</>
                {h.clienteSeleccionado.limite_deuda && (
                  <> / límite Q{Number(h.clienteSeleccionado.limite_deuda).toFixed(2)}</>
                )}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                Saldo anterior (Q) *
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                className={`${CLS_CPC.input} w-full`}
                value={h.form.monto}
                onChange={(e) => h.setForm({ ...h.form, monto: e.target.value })}
                placeholder="0.00"
                aria-label="Saldo anterior"
              />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                Fecha límite de pago (opcional)
              </label>
              <input
                type="date"
                className={`${CLS_CPC.input} w-full`}
                value={h.form.fecha_limite_pago}
                onChange={(e) => h.setForm({ ...h.form, fecha_limite_pago: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={h.crearDeuda}
              className="px-4 py-[0.4rem] rounded-[14px] bg-success text-white border-none cursor-pointer"
            >
              Guardar saldo anterior
            </button>
            <button
              type="button"
              onClick={h.cerrarFormularioDeuda}
              className="px-4 py-[0.4rem] rounded-[14px] bg-line border-none cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={tabPillClass(h.vista === "acumulado")}
          onClick={() => h.setVista("acumulado")}
        >
          Acumulado por cliente
        </button>
        <button
          type="button"
          className={tabPillClass(h.vista === "vencimiento")}
          onClick={() => h.setVista("vencimiento")}
        >
          Próximas a vencer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={h.qDeudas}
          onChange={(e) => h.setQDeudas(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar en cuentas por cobrar"
          className={`${CLS_CPC.input} flex-[1_1_220px] min-w-[200px] w-auto`}
        />
        {h.vista === "vencimiento" && (
          <select
            value={h.filtroVencimiento}
            onChange={(e) => h.setFiltroVencimiento(e.target.value as typeof h.filtroVencimiento)}
            aria-label="Filtrar por vencimiento"
            className={`${CLS_CPC.input} w-auto min-w-[190px]`}
          >
            <option value="todas">Todos los vencimientos</option>
            <option value="vencidas">Vencidas</option>
            <option value="proximas">Vencen en 3 días o menos</option>
            <option value="sin_fecha">Sin fecha límite</option>
          </select>
        )}
        <label className="flex items-center gap-[0.4rem] text-[0.85rem] text-ink-muted cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={h.soloBloqueados}
            onChange={(e) => h.setSoloBloqueados(e.target.checked)}
          />
          Solo clientes bloqueados
        </label>
      </div>

      {h.vista === "acumulado" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[0.9rem]">
            <thead>
              <tr className="border-b-2 border-line text-left">
                <th className={CLS_CPC.td}>Persona</th>
                <th className={CLS_CPC.td}>Estado</th>
                <th className={CLS_CPC.td}>Saldo por cobrar acumulado</th>
                <th className={CLS_CPC.td}></th>
              </tr>
            </thead>
            <tbody>
              {h.gruposPage.slice.map((g) => (
                <Fragment key={g.key}>
                  <tr className="border-b border-line">
                    <td className={CLS_CPC.td}>
                      {g.nombre}
                      {g.telefono && (
                        <div className="text-ink-muted text-[0.78rem]">{g.telefono}</div>
                      )}
                    </td>
                    <td className={CLS_CPC.td}>
                      {g.id_cliente === null ? (
                        <span className="text-ink-muted">Sin vincular</span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            g.cliente_puede_comprar ? "text-success" : "text-danger"
                          }`}
                        >
                          {g.cliente_puede_comprar ? "Activo" : "Bloqueado"}
                        </span>
                      )}
                    </td>
                    <td className={`${CLS_CPC.td} font-semibold`}>
                      Q{g.totalPendiente.toFixed(2)}
                      {g.limite_deuda !== null && (
                        <span className="text-ink-muted font-normal">
                          {" "}
                          / límite Q{g.limite_deuda.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className={CLS_CPC.td}>
                      <button
                        type="button"
                        onClick={() => h.toggleExpandido(g.key)}
                        className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none cursor-pointer text-[0.8rem]"
                      >
                        {h.expandidos.has(g.key) ? "Ocultar detalle" : "Detalle"}
                      </button>
                    </td>
                  </tr>
                  {h.expandidos.has(g.key) && (
                    <tr key={`${g.key}-detalle`}>
                      <td colSpan={4} className="px-3 pt-0 pb-4">
                        <table className="w-full min-w-[760px] border-collapse text-[0.82rem]">
                          <thead>
                            <tr className="text-ink-muted text-left">
                              <th className={CLS_CPC.tdSm}>Fecha inicio</th>
                              <th className={CLS_CPC.tdSm}>Fecha límite</th>
                              <th className={CLS_CPC.tdSm}>Productos</th>
                              <th className={CLS_CPC.tdSm}>Monto</th>
                              <th className={CLS_CPC.tdSm}>Saldo / cubierto</th>
                              <th className={CLS_CPC.tdSm}>Estado</th>
                              <th className={CLS_CPC.tdSm}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.deudas.map((d) => (
                              <Fragment key={d.id_deuda}>
                                <tr className="border-t border-line">
                                  <td className={CLS_CPC.tdSm}>
                                    {new Date(d.fecha_inicio).toLocaleDateString("es-GT")}
                                  </td>
                                  <td className={CLS_CPC.tdSm}>
                                    {d.fecha_limite_pago
                                      ? new Date(d.fecha_limite_pago).toLocaleDateString("es-GT")
                                      : "—"}
                                  </td>
                                  <td className={`${CLS_CPC.tdSm} text-ink-muted`}>
                                    {d.productos.length > 0
                                      ? d.productos
                                          .map((p) => `${p.nombre_producto} x${p.cantidad}`)
                                          .join(", ")
                                      : "—"}
                                  </td>
                                  <td className={`${CLS_CPC.tdSm} font-semibold`}>
                                    Q{Number(d.monto_total).toFixed(2)}
                                  </td>
                                  <td className={`${CLS_CPC.tdSm} min-w-[140px]`}>
                                    <SaldoCubierto d={d} />
                                  </td>
                                  <td className={CLS_CPC.tdSm}>
                                    <span
                                      className={`font-semibold ${
                                        d.estado_deuda === "PAGADA" ? "text-success" : "text-danger"
                                      }`}
                                    >
                                      {d.estado_deuda === "PAGADA" ? "Pagada" : "Pendiente"}
                                    </span>
                                  </td>
                                  <td className={CLS_CPC.tdSm}>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {d.estado_deuda === "PENDIENTE" && (
                                        <button
                                          type="button"
                                          onClick={() => h.abrirPago(d.id_deuda)}
                                          className="px-[0.6rem] py-1 rounded-[14px] bg-market text-black border-none cursor-pointer text-[0.75rem]"
                                        >
                                          Registrar pago
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => h.cambiarEstado(d.id_deuda)}
                                        disabled={h.cambiandoId === d.id_deuda}
                                        className={`px-[0.6rem] py-1 rounded-[14px] text-white border-none text-[0.75rem] ${
                                          d.estado_deuda === "PAGADA" ? "bg-danger" : "bg-success"
                                        } ${
                                          h.cambiandoId === d.id_deuda
                                            ? "cursor-default opacity-60"
                                            : "cursor-pointer"
                                        }`}
                                      >
                                        {h.cambiandoId === d.id_deuda
                                          ? "…"
                                          : d.estado_deuda === "PAGADA"
                                          ? "Marcar pendiente"
                                          : "Marcar pagada"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {d.cuotas && d.cuotas.length > 0 && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: "0 0.4rem 0.8rem" }}>
                                      <PlanPagos deuda={d} />
                                    </td>
                                  </tr>
                                )}
                                {h.pagandoId === d.id_deuda && (
                                  <tr>
                                    <td colSpan={7} className="pt-2 px-[0.4rem] pb-[0.9rem]">
                                      <FormPago
                                        saldo={Number(d.saldo_pendiente)}
                                        regla={h.reglaDe(d)}
                                        monto={h.montoPago}
                                        setMonto={h.setMontoPago}
                                        metodo={h.metodoPago}
                                        setMetodo={h.setMetodoPago}
                                        error={h.errorPago}
                                        guardando={h.guardandoPago}
                                        onGuardar={() => h.registrarPago(d.id_deuda)}
                                        onCancelar={h.cerrarPago}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {h.gruposPage.slice.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-ink-muted">
                    {h.qDeudas.trim() || h.soloBloqueados
                      ? "Ningún resultado para esa búsqueda o filtro."
                      : "No hay cuentas por cobrar registradas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
<PaginationBar
              total={h.gruposPage.total}
              page={h.gruposPage.paginaSegura}
              perPage={h.perPage}
              onPageChange={() => {}}
              onPerPageChange={() => {}}
              noun="clientes"
            />
          </div>
        )}
      ))}

      {h.vista === "vencimiento" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[0.9rem]">
            <thead>
              <tr className="border-b-2 border-line text-left">
                <th className={CLS_CPC.td}>Persona</th>
                <th className={CLS_CPC.td}>Monto</th>
                <th className={CLS_CPC.td}>Saldo / cubierto</th>
                <th className={CLS_CPC.td}>Fecha límite</th>
                <th className={CLS_CPC.td}>Vencimiento</th>
                <th className={CLS_CPC.td}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {h.vencimientoPage.slice.map((d) => {
                const rest = diasRestantes(d.fecha_limite_pago);
                return (
                  <Fragment key={d.id_deuda}>
                    <tr className="border-b border-line">
                      <td className={CLS_CPC.td}>
                        {d.nombre_deudor}
                        {d.id_cliente !== null && d.cliente_puede_comprar === false && (
                          <span className={CLS_CPC.badgeBloqueado}>bloqueado</span>
                        )}
                      </td>
                      <td className={`${CLS_CPC.td} font-semibold`}>
                        Q{Number(d.monto_total).toFixed(2)}
                      </td>
                      <td className={`${CLS_CPC.td} min-w-[140px]`}>
                        <SaldoCubierto d={d} />
                      </td>
                      <td className={`${CLS_CPC.td} text-ink-muted`}>
                        {d.fecha_limite_pago
                          ? new Date(d.fecha_limite_pago).toLocaleDateString("es-GT")
                          : "—"}
                      </td>
                      <td className={`${CLS_CPC.td} font-semibold ${rest.cls}`}>{rest.texto}</td>
                      <td className={CLS_CPC.td}>
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => h.abrirPago(d.id_deuda)}
                            className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-market text-white border-none cursor-pointer text-[0.8rem]"
                          >
                            Registrar pago
                          </button>
                          <button
                            type="button"
                            onClick={() => h.cambiarEstado(d.id_deuda)}
                            disabled={h.cambiandoId === d.id_deuda}
                            className={`px-[0.8rem] py-[0.3rem] rounded-[14px] bg-success text-white border-none text-[0.8rem] ${
                              h.cambiandoId === d.id_deuda
                                ? "cursor-default opacity-60"
                                : "cursor-pointer"
                            }`}
                          >
                            {h.cambiandoId === d.id_deuda ? "Guardando…" : "Marcar pagada"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {h.pagandoId === d.id_deuda && (
                      <tr>
                        <td colSpan={6} className="pt-2 px-3 pb-4">
                          <FormPago
                            saldo={Number(d.saldo_pendiente)}
                            regla={h.reglaDe(d)}
                            monto={h.montoPago}
                            setMonto={h.setMontoPago}
                            metodo={h.metodoPago}
                            setMetodo={h.setMetodoPago}
                            error={h.errorPago}
                            guardando={h.guardandoPago}
                            onGuardar={() => h.registrarPago(d.id_deuda)}
                            onCancelar={h.cerrarPago}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {h.vencimientoPage.slice.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink-muted">
                    No hay cuentas por cobrar pendientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
<PaginationBar
              total={h.vencimientoPage.total}
              page={h.vencimientoPage.paginaSegura}
              perPage={h.perPage}
              onPageChange={() => {}}
              onPerPageChange={() => {}}
              noun="cuentas por cobrar"
            />
        </div>
      )}
    </>
  );
}
