import { TIPOS_USUARIO } from "@/lib/roles";
import { TIPO_META } from "@/lib/constants/usuarios";
import { s } from "@/lib/styles/usuarios";
import { rolDescripcion } from "@/lib/constants/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuarioModalEditar({ u }: { u: UsuariosController }) {
  if (!u.editando) return null;

  return (
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) u.setEditando(null);
      }}
    >
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Editar usuario</h2>
          <button type="button" onClick={() => u.setEditando(null)} style={s.closeBtn}>
            ✕
          </button>
        </div>
        <div style={s.modalBody}>
          <div style={s.userInfoBox}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{u.editando.nombre}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{u.editando.correo}</div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Rol / Tipo de usuario</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {Object.entries(TIPO_META).map(([val, meta]) => {
                const activo = u.editTipo === val;
                const esAscensoADueno = val === TIPOS_USUARIO.DUENO && u.editando?.tipo_usuario !== TIPOS_USUARIO.DUENO;

                if (esAscensoADueno) {
                  return (
                    <div
                      key={val}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.65rem 0.85rem",
                        borderRadius: 10,
                        border: "1px dashed var(--border)",
                        background: "var(--surface2)",
                        opacity: 0.75,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text)" }}>{meta.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          {u.limiteDuenosAlcanzado
                            ? `Ya hay ${u.limiteDuenos} dueños activos (el límite). Sube el límite o desactiva a alguno antes.`
                            : "Requiere el proceso aparte de verificación por correo (botón 👑)."}
                        </div>
                      </div>
                    </div>
                  );
                }

                const sinCupo = u.editEstado && u.editando?.tipo_usuario !== val && u.cupoLleno(val);

                return (
                  <label
                    key={val}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.65rem 0.85rem",
                      borderRadius: 10,
                      border: `1px solid ${activo ? meta.border : "var(--border)"}`,
                      background: activo ? meta.bg : "var(--surface2)",
                      cursor: sinCupo ? "not-allowed" : "pointer",
                      opacity: sinCupo ? 0.55 : 1,
                      transition: "all .15s",
                    }}
                    title={sinCupo ? `El límite de ${meta.label.toLowerCase()} está lleno` : undefined}
                  >
                    <input
                      type="radio"
                      name="tipo_usuario"
                      value={val}
                      checked={activo}
                      disabled={sinCupo}
                      onChange={() => u.setEditTipo(val)}
                      style={{ accentColor: meta.color }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          color: activo ? meta.color : "var(--text)",
                        }}
                      >
                        {meta.label}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {sinCupo ? "Límite de usuarios alcanzado" : rolDescripcion(val)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {u.editTipo === TIPOS_USUARIO.BODEGUERO && (
            <div style={s.field}>
              <label style={s.label}>Bodega asignada</label>
              <select style={s.input} value={u.editBodega} onChange={(e) => u.setEditBodega(e.target.value)}>
                <option value="">Selecciona una bodega…</option>
                {u.bodegas.map((b) => (
                  <option key={b.id_bodega} value={b.id_bodega}>
                    {b.nombre_bodega}
                  </option>
                ))}
              </select>
            </div>
          )}

          {u.editTipo === TIPOS_USUARIO.EMPLEADO && (
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
                  checked={u.editRequiere2fa}
                  onChange={(e) => u.setEditRequiere2fa(e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text)" }}>
                    Requiere verificación en dos pasos (2FA)
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    Si lo desmarcas, este colaborador entra directo con usuario y contraseña, sin código por correo.
                  </div>
                </div>
              </label>
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Estado de la cuenta</label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {[
                { val: true, label: "Activa" },
                { val: false, label: "Inactiva" },
              ].map(({ val, label }) => (
                <label
                  key={String(val)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.55rem 0.9rem",
                    borderRadius: 10,
                    border: `1px solid ${
                      u.editEstado === val
                        ? val
                          ? "rgba(63,185,80,.4)"
                          : "rgba(248,81,73,.4)"
                        : "var(--border)"
                    }`,
                    background:
                      u.editEstado === val
                        ? val
                          ? "rgba(63,185,80,.1)"
                          : "rgba(248,81,73,.1)"
                        : "var(--surface2)",
                    cursor: "pointer",
                    flex: 1,
                    justifyContent: "center",
                  }}
                >
                  <input
                    type="radio"
                    name="estado_usuario"
                    checked={u.editEstado === val}
                    onChange={() => u.setEditEstado(val)}
                    style={{
                      accentColor: val ? "var(--green)" : "var(--red)",
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      color:
                        u.editEstado === val
                          ? val
                            ? "var(--green)"
                            : "var(--red)"
                          : "var(--muted)",
                    }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {u.editError && <div style={s.errorBox}>{u.editError}</div>}
        </div>
        <div style={s.modalFooter}>
          <button type="button" onClick={() => u.setEditando(null)} style={s.btnSecondary} disabled={u.savingEdit}>
            Cancelar
          </button>
          <button type="button" onClick={u.guardarEdicion} style={s.btnPrimary} disabled={u.savingEdit}>
            {u.savingEdit ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
