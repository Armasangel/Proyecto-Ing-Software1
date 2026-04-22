// app/api/facturacion/route.ts
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
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
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
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>{mensaje}</p>
      )}
      {ventas.length === 0 ? (
        <div style={{ padding: "1.75rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", maxWidth: 520 }}>
          <p style={{ color: "#91a7ff", fontWeight: 700, marginBottom: "0.75rem" }}>Sin ventas registradas</p>
          <p style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.6 }}>
            Las ventas aparecen aquí cuando un comprador confirma su pedido en línea.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem" }}>#Venta</th>
                <th style={{ padding: "0.75rem" }}>Cliente</th>
                <th style={{ padding: "0.75rem" }}>Fecha</th>
                <th style={{ padding: "0.75rem" }}>Total</th>
                <th style={{ padding: "0.75rem" }}>Estado</th>
                <th style={{ padding: "0.75rem" }}># Factura</th>
                <th style={{ padding: "0.75rem" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id_venta} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem", color: "var(--muted)" }}>{v.id_venta}</td>
                  <td style={{ padding: "0.75rem" }}>{v.nombre}</td>
                  <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                    {new Date(v.fecha_venta).toLocaleDateString("es-GT")}
                  </td>
                  <td style={{ padding: "0.75rem" }}>Q{Number(v.total).toFixed(2)}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: 20,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background: v.estado_venta === "CONFIRMADO" ? "#52b78833" : "#91a7ff33",
                      color: v.estado_venta === "CONFIRMADO" ? "#52b788" : "#91a7ff",
                    }}>
                      {v.estado_venta}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                    {v.numero_factura || "—"}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {!v.id_factura && (
                      <button
                        onClick={() => emitirFactura(v.id_venta, v.nombre)}
                        disabled={cargando}
                        style={{ padding: "0.3rem 0.8rem", borderRadius: 6, background: "#52b788", color: "#fff", border: "none", cursor: "pointer" }}
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