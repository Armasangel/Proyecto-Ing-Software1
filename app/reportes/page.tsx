"use client";

import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo, TIPOS_USUARIO } from "@/lib/roles";

export default function ReportesPage() {
  const usuario = useStaffSession();

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const esDueno = usuario.tipo_usuario === TIPOS_USUARIO.DUENO;
  const accent = staffVariantFromTipo(usuario.tipo_usuario) === "dueno" ? "#52b788" : "#91a7ff";

  return (
    <StaffShell
      usuario={usuario}
      title="Reportes"
      subtitle={
        esDueno
          ? "Indicadores y exportaciones (dueño)"
          : "Indicadores operativos (colaborador)"
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
          Próximamente
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.92rem" }}>
          Este espacio puede alimentarse de vistas como{" "}
          <code style={{ color: "var(--text)" }}>v_deudores</code>, rotación de inventario y ventas por
          periodo. Misma estructura de panel que el resto del personal; el dueño puede ampliar permisos
          cuando lo necesites.
        </p>
      </div>
    </StaffShell>
  );
}
