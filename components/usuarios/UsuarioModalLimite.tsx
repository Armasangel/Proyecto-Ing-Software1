import { TIPO_META } from "@/lib/constants/usuarios";
import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuarioModalLimite({ u }: { u: UsuariosController }) {
  if (!u.limTipo) return null;

  return (
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) u.cerrarLimite();
      }}
    >
      <div style={{ ...s.modal, maxWidth: 440 }}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Límite de {(TIPO_META[u.limTipo]?.label ?? u.limTipo).toLowerCase()}s</h2>
          <button type="button" onClick={u.cerrarLimite} style={s.closeBtn} disabled={u.limLoading}>
            ✕
          </button>
        </div>
        <div style={s.modalBody}>
          <div style={s.userInfoBox}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>Activos ahora: {u.cupos[u.limTipo]?.activos ?? 0}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Configuración actual: {u.textoLimite(u.limTipo)}</div>
          </div>

          {u.limPaso === "inicial" ? (
            <>
              <div style={s.field}>
                <label style={s.label}>Máximo de usuarios activos</label>
                <input
                  style={s.input}
                  type="number"
                  min={Math.max(1, u.cupos[u.limTipo]?.activos ?? 1)}
                  max={500}
                  value={u.limValor}
                  onChange={(e) => u.setLimValor(e.target.value)}
                  disabled={u.limSinLimite}
                  placeholder="Ej: 5"
                  autoFocus
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={u.limSinLimite}
                  onChange={(e) => u.setLimSinLimite(e.target.checked)}
                />
                Sin límite
              </label>
              {u.limTipo === "DUENO" && (
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.55 }}>
                  Ojo: un Dueño tiene acceso total al sistema. Cada ascenso a Dueño sigue pidiendo su propia verificación por correo.
                </p>
              )}
              <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                Por seguridad, antes de aplicar el cambio te mandamos un código de confirmación a{" "}
                <strong style={{ color: "var(--text)" }}>tu propio correo</strong>. Solo cuentan los usuarios activos.
              </p>
            </>
          ) : (
            <>
              <p style={{ color: "var(--muted)", lineHeight: 1.65, fontSize: "0.88rem" }}>
                Te mandamos un código de 6 dígitos a{" "}
                <strong style={{ color: "var(--text)" }}>{u.limCorreoEnmascarado}</strong>. Ingrésalo para confirmar el nuevo límite (
                {u.limSinLimite ? "sin límite" : u.limValor}).
              </p>
              <div style={s.field}>
                <label style={s.label}>Código de verificación</label>
                <input
                  style={{ ...s.input, letterSpacing: "0.3em", textAlign: "center", fontSize: "1.2rem" }}
                  value={u.limCodigo}
                  onChange={(e) => u.setLimCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
            </>
          )}

          {u.limError && <div style={s.errorBox}>{u.limError}</div>}
        </div>
        <div style={s.modalFooter}>
          <button type="button" onClick={u.cerrarLimite} style={s.btnSecondary} disabled={u.limLoading}>
            Cancelar
          </button>
          {u.limPaso === "inicial" ? (
            <button type="button" onClick={u.solicitarCambioLimite} style={s.btnPrimary} disabled={u.limLoading}>
              {u.limLoading ? "Enviando código…" : "Enviar código de confirmación"}
            </button>
          ) : (
            <button type="button" onClick={u.confirmarCambioLimite} style={s.btnPrimary} disabled={u.limLoading || u.limCodigo.length !== 6}>
              {u.limLoading ? "Confirmando…" : "Confirmar límite"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
