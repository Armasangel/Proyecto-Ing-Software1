"use client";

import { StaffShell } from "@/components/StaffShell";
import { useFacturacion } from "@/hooks/useFacturacion";
import { FacturacionFiltros } from "@/components/facturacion/FacturacionFiltros";
import { FacturacionTabla } from "@/components/facturacion/FacturacionTabla";

export default function FacturacionPage() {
  const f = useFacturacion();

  if (!f.usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  return (
    <StaffShell usuario={f.usuario} title="Facturación" subtitle="Registro y emisión de facturas por venta">
      {f.mensaje && (
        <p key={f.mensaje} className="text-market-600 mb-4 font-semibold flex items-center gap-2 animate-stamp">
          <span className="inline-flex w-5 h-5 rounded-full bg-market text-white items-center justify-center text-xs shrink-0">✓</span>
          {f.mensaje}
        </p>
      )}
      {f.errorDetalle && (
        <p key={f.errorDetalle} className="mb-4 font-semibold" style={{ color: "var(--red)" }}>
          {f.errorDetalle}
        </p>
      )}
      {f.ventas.length === 0 ? (
        <div className="p-7 rounded-card border border-[var(--border)] bg-white shadow-warm max-w-[520px]">
          <p className="text-mango-600 font-bold mb-3">Sin ventas registradas</p>
          <p className="text-ink-muted text-[0.92rem] leading-relaxed">
            Las ventas aparecen aquí cuando un comprador confirma su pedido en línea.
          </p>
        </div>
      ) : (
        <>
          <FacturacionFiltros f={f} />
          <FacturacionTabla f={f} />
        </>
      )}
    </StaffShell>
  );
}
