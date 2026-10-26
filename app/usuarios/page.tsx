"use client";

import { StaffShell } from "@/components/StaffShell";
import { PanelAuditoria } from "@/components/PanelAuditoria";
import { useUsuarios } from "@/hooks/useUsuarios";
import { UsuariosResumen } from "@/components/usuarios/UsuariosResumen";
import { UsuariosToolbar } from "@/components/usuarios/UsuariosToolbar";
import { UsuariosTabla } from "@/components/usuarios/UsuariosTabla";
import { UsuarioModalEditar } from "@/components/usuarios/UsuarioModalEditar";
import { UsuarioModalNuevo } from "@/components/usuarios/UsuarioModalNuevo";
import { UsuarioModalPromover } from "@/components/usuarios/UsuarioModalPromover";
import { UsuarioModalLimite } from "@/components/usuarios/UsuarioModalLimite";
import { UsuarioModalConfirmarToggle } from "@/components/usuarios/UsuarioModalConfirmarToggle";
import { UsuariosToast } from "@/components/usuarios/UsuariosToast";

export default function UsuariosPage() {
  const u = useUsuarios();

  if (!u.usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <StaffShell
      usuario={u.usuario}
      title="Gestión de usuarios"
      subtitle={`${u.usuarios.length} usuario${u.usuarios.length !== 1 ? "s" : ""} encontrado${u.usuarios.length !== 1 ? "s" : ""}`}
    >
      <UsuariosResumen u={u} />
      <UsuariosToolbar u={u} />
      <UsuariosTabla u={u} />
      <UsuarioModalEditar u={u} />
      <UsuarioModalNuevo u={u} />
      <UsuarioModalConfirmarToggle u={u} />
      <UsuarioModalLimite u={u} />
      <UsuarioModalPromover u={u} />
      <UsuariosToast u={u} />
      <PanelAuditoria />
    </StaffShell>
  );
}
