"use client";

import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { Icon } from "@/components/Icon";
import { useVentas } from "@/hooks/useVentas";
import { isStaffTipo } from "@/lib/roles";
import { VentasClienteSeccion } from "@/components/ventas/VentasClienteSeccion";
import { VentasPagoEntrega } from "@/components/ventas/VentasPagoEntrega";
import { VentasCredito } from "@/components/ventas/VentasCredito";
import { VentasLineas } from "@/components/ventas/VentasLineas";
import { VentasResumen } from "@/components/ventas/VentasResumen";
import { VentasMensajes } from "@/components/ventas/VentasMensajes";
import { ConfirmarVentaModal } from "@/components/ventas/ConfirmarVentaModal";
import { VentasRecientes } from "@/components/ventas/VentasRecientes";

export default function VentasPage() {
  const v = useVentas();

  if (!v.usuario) return <p className="p-8 text-ink-muted">Cargando…</p>;
  if (!isStaffTipo(v.usuario.tipo_usuario)) return <p className="p-8 text-ink-muted">Redirigiendo…</p>;

  return (
    <StaffShell usuario={v.usuario} title="Ventas" subtitle="Registro de ventas, créditos y pedidos de entrega">
      <div className="flex flex-col gap-8">
        <div className="max-w-[720px] flex justify-end -mb-5">
          <Link href="/ordenes" className="text-[0.85rem] font-semibold text-market-600 hover:underline">
            Ver pedidos de entrega →
          </Link>
        </div>

        <div className="max-w-[720px] bg-white border border-[var(--border)] rounded-card shadow-warm p-7">
          <div className="flex items-center gap-4 mb-6 border-b-2 border-market pb-4">
            <div className="w-12 h-12 rounded-control bg-market/10 border border-market/25 flex items-center justify-center shrink-0">
              <Icon name="bill" variant="dark" size={26} />
            </div>
            <div>
              <p className="m-0 text-ink-muted text-[0.88rem]">
                Cada venta guarda la transacción (<code>venta</code>) y los productos (<code>detalle_venta</code>). Cada producto puede salir de una bodega distinta; el inventario se descuenta por bodega y queda trazado en kardex.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <VentasClienteSeccion v={v} />
            <VentasPagoEntrega v={v} />
            <VentasCredito v={v} />
            <VentasLineas v={v} />
            <VentasResumen v={v} />
          </div>

          <VentasMensajes v={v} />
        </div>

        <ConfirmarVentaModal v={v} />
        <VentasRecientes v={v} />
      </div>
    </StaffShell>
  );
}
