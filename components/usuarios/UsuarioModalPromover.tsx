import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuarioModalPromover({ u }: { u: UsuariosController }) {
  if (!u.promoviendo) return null;

  return (
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) u.cerrarPromover();
      }}
    >
      <div style={{ ...s.modal, maxWidth: 440 }}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Promover a Dueño</h2>
          <button type="button" onClick={u.cerrarPromover} style={s.closeBtn} disabled={u.promoLoading}>
            ✕
          </button>
        </div>
        <div style={s.modalBody}>
          <div style={s.userInfoBox}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{u.promoviendo.nombre}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{u.promoviendo.correo}</div>
          </div>

          {u.promoPaso === "inicial" ? (
            <p style={{ color: "var(--muted)", lineHeight: 1.65, fontSize: "0.88rem" }}>
              Vas a dar el rol de <strong style={{ color: "var(--accent)" }}>Dueño</strong> a este usuario (acceso total al sistema). Por seguridad, primero te vamos a mandar un código de confirmación a{" "}
              <strong style={{ color: "var(--text)" }}>tu propio correo</strong>, no al de él.
            </p>
          ) : (
            <>
              <p style={{ color: "var(--muted)", lineHeight: 1.65, fontSize: "0.88rem" }}>
                Te mandamos un código de 6 dígitos a{" "}
                <strong style={{ color: "var(--text)" }}>{u.promoCorreoEnmascarado}</strong>. Ingrésalo para confirmar el ascenso.
              </p>
              <div style={s.field}>
                <label style={s.label}>Código de verificación</label>
                <input
                  style={{ ...s.input, letterSpacing: "0.3em", textAlign: "center", fontSize: "1.2rem" }}
                  value={u.promoCodigo}
                  onChange={(e) => u.setPromoCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
            </>
          )}

          {u.promoError && <div style={s.errorBox}>{u.promoError}</div>}
        </div>
        <div style={s.modalFooter}>
          <button type="button" onClick={u.cerrarPromover} style={s.btnSecondary} disabled={u.promoLoading}>
            Cancelar
          </button>
          {u.promoPaso === "inicial" ? (
            <button type="button" onClick={u.solicitarPromocion} style={s.btnPrimary} disabled={u.promoLoading}>
              {u.promoLoading ? "Enviando código…" : "Enviar código de confirmación"}
            </button>
          ) : (
            <button type="button" onClick={u.confirmarPromocion} style={s.btnPrimary} disabled={u.promoLoading || u.promoCodigo.length !== 6}>
              {u.promoLoading ? "Confirmando…" : "Confirmar ascenso"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
