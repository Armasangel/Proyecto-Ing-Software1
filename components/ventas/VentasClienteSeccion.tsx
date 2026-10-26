import { ClienteAutocompletar } from "@/components/ClienteAutocompletar";
import { FormularioCliente } from "@/components/clientes/FormularioCliente";
import { inputCls, labelCls } from "@/lib/styles/forms";
import type { VentasController } from "@/hooks/useVentas";

export function VentasClienteSeccion({ v }: { v: VentasController }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>Cliente *</label>
      <div className="relative">
        <ClienteAutocompletar
          clientes={v.clientes}
          sugeridos={v.sugeridosCliente}
          value={v.idCliente}
          onChange={v.onClienteChange}
          onSelect={v.seleccionarCliente}
          placeholder="Buscar cliente por código, nombre, NIT o teléfono…"
          ariaLabel="Buscar cliente"
          className={inputCls}
          tituloSugeridos="Clientes frecuentes"
          detalle={(c) =>
            c.total_ventas
              ? `${c.total_ventas} ${c.total_ventas === 1 ? "venta" : "ventas"}`
              : null
          }
        />
        {v.idCliente && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={v.limpiarClienteSeleccionado}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-sm"
            title="Cambiar de cliente"
          >
            ✕
          </button>
        )}
      </div>

      {v.clienteSeleccionado && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-2 rounded-control bg-cream/40 border border-[var(--border)] text-[0.82rem]">
          <span>
            <span className="text-ink-muted">Código: </span>
            <strong className="font-semibold">{v.clienteSeleccionado.codigo_cliente || "—"}</strong>
          </span>
          <span>
            <span className="text-ink-muted">NIT: </span>
            <strong className="font-semibold">{v.clienteSeleccionado.nit_cliente || "CF"}</strong>
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-ink-muted">Dirección: </span>
            <strong className="font-semibold">{v.clienteSeleccionado.direccion || "—"}</strong>
          </span>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => {
            v.setCreandoCliente((valor) => !valor);
          }}
          className="text-[0.84rem] font-semibold text-market-600 hover:underline"
        >
          {v.creandoCliente ? "Cancelar cliente nuevo" : "+ Cliente nuevo"}
        </button>
      </div>

      {v.avisoCliente && v.idCliente && !v.creandoCliente && (
        <div className="text-[0.85rem] text-market-600 font-medium">{v.avisoCliente}</div>
      )}

      {v.creandoCliente && (
        <FormularioCliente
          variant="inline"
          correoObligatorio
          validarFormatoCorreo
          onCancelar={() => v.setCreandoCliente(false)}
          onCreado={v.onClienteCreado}
        />
      )}
    </div>
  );
}
