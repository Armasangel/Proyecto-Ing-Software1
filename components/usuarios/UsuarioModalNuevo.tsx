import { TIPOS_USUARIO } from "@/lib/roles";
import { EMPTY_FORM, TIPO_META } from "@/lib/constants/usuarios";
import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuarioModalNuevo({ u }: { u: UsuariosController }) {
  if (!u.modalNuevo) return null;

  return (
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) u.setModalNuevo(false);
      }}
    >
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Nuevo usuario</h2>
          <button type="button" onClick={() => u.setModalNuevo(false)} style={s.closeBtn}>
            ✕
          </button>
        </div>
        <div style={s.modalBody}>
          <div style={s.field}>
            <label style={s.label}>Nombre completo *</label>
            <input
              style={s.input}
              value={u.nuevoForm.nombre}
              onChange={(e) => u.setNuevoForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Ana García López"
              autoFocus
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Correo electrónico *</label>
            <input
              style={{
                ...s.input,
                borderColor: !u.correoNuevoValido
                  ? "rgba(248,81,73,.6)"
                  : u.nuevoForm.correo.trim() && u.correoNuevoCompleto
                  ? "rgba(63,185,80,.5)"
                  : "var(--border)",
                boxShadow: !u.correoNuevoValido ? "0 0 0 3px rgba(248,81,73,.1)" : undefined,
              }}
              type="text"
              value={u.nuevoForm.correo}
              onChange={(e) => u.setNuevoForm((f) => ({ ...f, correo: e.target.value }))}
              placeholder="ana@ejemplo.com"
            />
            {!u.correoNuevoValido && (
              <span style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: "0.1rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                ⚠ El correo debe incluir &ldquo;@&rdquo; y un dominio válido
              </span>
            )}
            {u.nuevoForm.correo.trim() && u.correoNuevoCompleto && (
              <span style={{ fontSize: "0.75rem", color: "var(--green)", marginTop: "0.1rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                ✓ Formato de correo válido
              </span>
            )}
          </div>
          <div style={s.field}>
            <label style={s.label}>Teléfono (opcional)</label>
            <input
              style={s.input}
              value={u.nuevoForm.telefono}
              onChange={(e) => u.setNuevoForm((f) => ({ ...f, telefono: e.target.value }))}
              placeholder="5555-1234"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña inicial *</label>
            <input
              style={s.input}
              type="password"
              value={u.nuevoForm.contrasena}
              onChange={(e) => u.setNuevoForm((f) => ({ ...f, contrasena: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Rol</label>
            <select
              style={s.input}
              value={u.nuevoForm.tipo_usuario}
              onChange={(e) => u.setNuevoForm((f) => ({ ...f, tipo_usuario: e.target.value }))}
            >
              {Object.entries(TIPO_META)
                .filter(([val]) => val !== TIPOS_USUARIO.DUENO)
                .map(([val, meta]) => (
                  <option key={val} value={val} disabled={u.cupoLleno(val)}>
                    {meta.label}
                    {u.cupoLleno(val) ? " (límite alcanzado)" : ""}
                  </option>
                ))}
            </select>
            {u.cupoLleno(u.nuevoForm.tipo_usuario) && (
              <span style={{ fontSize: "0.75rem", color: "var(--red, #f85149)" }}>
                Ya se alcanzó el límite de este rol. Sube el límite desde las tarjetas de arriba o elige otro rol.
              </span>
            )}
          </div>

          {u.cuposDueno && (
            <div
              role="note"
              data-testid="nota-cupos-dueno"
              style={{
                fontSize: "0.76rem",
                color: "var(--muted)",
                background: "var(--surface2)",
                border: "1px dashed var(--border)",
                borderRadius: 10,
                padding: "0.6rem 0.8rem",
              }}
            >
              <strong style={{ color: u.limiteDuenosAlcanzado ? "var(--red)" : "var(--green)" }}>{u.cuposResumen}.</strong>{" "}
              {u.limiteDuenosAlcanzado
                ? "Para dar el rol de dueño a otra persona, sube el límite o desactiva a uno de los actuales."
                : "El rol de dueño no se asigna al crear la cuenta: crea el usuario y luego usa el botón de promover de la tabla."}
            </div>
          )}

          {u.nuevoForm.tipo_usuario === TIPOS_USUARIO.BODEGUERO && (
            <div style={s.field}>
              <label style={s.label}>Bodega asignada</label>
              <select
                style={s.input}
                value={u.nuevoForm.id_bodega}
                onChange={(e) => u.setNuevoForm((f) => ({ ...f, id_bodega: e.target.value }))}
              >
                <option value="">Selecciona una bodega…</option>
                {u.bodegas.map((b) => (
                  <option key={b.id_bodega} value={b.id_bodega}>
                    {b.nombre_bodega}
                  </option>
                ))}
              </select>
            </div>
          )}

          {u.nuevoForm.tipo_usuario === TIPOS_USUARIO.EMPLEADO && (
            <div style={s.field}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.65rem 0.85rem",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={u.nuevoForm.requiere_2fa}
                  onChange={(e) => u.setNuevoForm((f) => ({ ...f, requiere_2fa: e.target.checked }))}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text)" }}>
                    Requiere verificación en dos pasos (2FA)
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    Desmárcalo para que este colaborador entre directo con usuario y contraseña, sin código por correo.
                  </div>
                </div>
              </label>
            </div>
          )}

          {u.nuevoError && <div style={s.errorBox}>{u.nuevoError}</div>}
        </div>
        <div style={s.modalFooter}>
          <button type="button" onClick={() => u.setModalNuevo(false)} style={s.btnSecondary} disabled={u.savingNuevo}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={u.crearUsuario}
            style={s.btnPrimary}
            disabled={u.savingNuevo || !u.nuevoForm.nombre || !u.correoNuevoCompleto || !u.nuevoForm.contrasena}
          >
            {u.savingNuevo ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}
