"use client";

import { StaffShell } from "@/components/StaffShell";
import { useProveedores } from "@/hooks/useProveedores";
import { ProveedoresToolbar } from "@/components/proveedores/ProveedoresToolbar";
import { ProveedoresForm } from "@/components/proveedores/ProveedoresForm";
import { ProveedoresTabla } from "@/components/proveedores/ProveedoresTabla";

export default function ProveedoresPage() {
  const h = useProveedores();

  if (!h.usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  if (h.usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={h.usuario} title="Gestión de Proveedores" subtitle="">
        <p className="text-ink-muted">No tienes permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  return (
    <StaffShell usuario={h.usuario} title="Gestión de Proveedores" subtitle="Administra los proveedores de la tienda">
      {h.mensaje && (
        <p key={h.mensaje} className="text-market-600 mb-4 font-semibold animate-toast-in">
          {h.mensaje}
        </p>
      )}

      {!h.creando && h.editando === null && (
        <button
          onClick={h.abrirNuevo}
          className="mb-6 px-5 py-2.5 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110"
        >
          + Nuevo proveedor
        </button>
      )}

      <ProveedoresForm h={h} />
      <ProveedoresToolbar h={h} />
      <ProveedoresTabla h={h} />
    </StaffShell>
  );
}
