"use client";

import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo, TIPOS_USUARIO } from "@/lib/roles";

export default function VentasPage() {
  const usuario = useStaffSession();

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const esDueno = usuario.tipo_usuario === TIPOS_USUARIO.DUENO;
  const accent = staffVariantFromTipo(usuario.tipo_usuario) === "dueno" ? "#52b788" : "#91a7ff";

  return (
    <StaffShell
      usuario={usuario}
      title="Ventas"
      subtitle={
        esDueno
          ? "Resumen y operación de ventas (dueño)"
          : "Consulta y registro de ventas (colaborador)"
      }
    >
      <div
        style={{
          maxWidth: 560,
          padding: "1.75rem",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <p style={{ color: accent, fontWeight: 700, marginBottom: "0.75rem" }}>
          Módulo en preparación
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.92rem" }}>
          Aquí conectarás pedidos, estados de venta y cobros con las tablas{" "}
          <code style={{ color: "var(--text)" }}>venta</code>,{" "}
          <code style={{ color: "var(--text)" }}>detalle_venta</code> y{" "}
          <code style={{ color: "var(--text)" }}>pago</code>. La navegación ya queda dentro del panel
          interno compartido entre dueño y colaborador.
        </p>
      </div>
    </StaffShell>
  );
}
