import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuarioModalConfirmarToggle({ u }: { u: UsuariosController }) {
  if (!u.confirmToggle) return null;

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: 420 }}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>
            {u.confirmToggle.estado_usuario ? "¿Desactivar cuenta?" : "¿Activar cuenta?"}
          </h2>
        </div>
        <div style={s.modalBody}>
          <p style={{ color: "var(--muted)", lineHeight: 1.65 }}>
            {u.confirmToggle.estado_usuario ? "La cuenta de " : "Se va a activar la cuenta de "}
            <strong style={{ color: "var(--text)" }}>{u.confirmToggle.nombre}</strong>
            {u.confirmToggle.estado_usuario
              ? " quedará inactiva. El usuario no podrá iniciar sesión hasta que la vuelvas a activar."
              : ". El usuario podrá volver a iniciar sesión."}
          </p>
        </div>
        <div style={s.modalFooter}>
          <button
            type="button"
            onClick={() => u.setConfirmToggle(null)}
            style={s.btnSecondary}
            disabled={u.toggling}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => u.toggleEstado(u.confirmToggle!)}
            disabled={u.toggling}
            style={{
              ...s.btnPrimary,
              background: u.confirmToggle.estado_usuario ? "var(--red)" : "var(--green)",
            }}
          >
            {u.toggling ? "Procesando…" : u.confirmToggle.estado_usuario ? "Sí, desactivar" : "Sí, activar"}
          </button>
        </div>
      </div>
    </div>
  );
}
