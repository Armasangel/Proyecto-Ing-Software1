"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

type Venta = {
  id_venta: number;
  fecha_venta: string;
  total: number;
  estado_venta: string;
  nombre: string;
  correo: string;
  id_factura: number | null;
  numero_factura: string | null;
  total_factura: number | null;
};

export default function FacturacionPage() {
  const usuario = useStaffSession();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch("/api/facturacion")
      .then((r) => r.json())
      .then((d) => setVentas(d.ventas || []));
  }, []);

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  async function emitirFactura(id_venta: number, nombre: string) {
    setCargando(true);
    setMensaje("");
    const res = await fetch("/api/facturacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_venta, nombre_cliente: nombre }),
    });
    const data = await res.json();
    if (res.ok) {
      setMensaje(`Factura ${data.numero_factura} emitida correctamente`);
      const updated = await fetch("/api/facturacion").then((r) => r.json());
      setVentas(updated.ventas || []);
    } else {
      setMensaje(data.error || "Error al emitir factura");
    }
    setCargando(false);
  }

  return (
    <StaffShell usuario={usuario} title="Facturación" subtitle="Registro y emisión de facturas por venta">
      {mensaje && (
        <p key={mensaje} className="text-market-600 mb-4 font-semibold flex items-center gap-2 animate-stamp">
          <span className="inline-flex w-5 h-5 rounded-full bg-market text-white items-center justify-center text-xs shrink-0">✓</span>
          {mensaje}
        </p>
      )}
      {ventas.length === 0 ? (
        <div className="p-7 rounded-card border border-[var(--border)] bg-white shadow-warm max-w-[520px]">
          <p className="text-mango-600 font-bold mb-3">Sin ventas registradas</p>
          <p className="text-ink-muted text-[0.92rem] leading-relaxed">
            Las ventas aparecen aquí cuando un comprador confirma su pedido en línea.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead>
              <tr className="bg-market">
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">#Venta</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Cliente</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Fecha</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Total</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white"># Factura</th>
                <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Acción</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v, i) => (
                <tr key={v.id_venta} className={i % 2 === 0 ? "bg-cream/40" : "bg-white"}>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">{v.id_venta}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink">{v.nombre}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">
                    {new Date(v.fecha_venta).toLocaleDateString("es-GT")}
                  </td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink">Q{Number(v.total).toFixed(2)}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)]">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        v.estado_venta === "CONFIRMADO" ? "bg-market-50 text-market-600" : "bg-mango-50 text-mango-600"
                      }`}
                    >
                      {v.estado_venta}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">{v.numero_factura || "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)]">
                    {!v.id_factura && (
                      <button
                        onClick={() => emitirFactura(v.id_venta, v.nombre)}
                        disabled={cargando}
                        className="px-3 py-1.5 rounded-control bg-market text-white border-none text-[0.85rem] font-medium transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-60"
                      >
                        Emitir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffShell>
  );
}
