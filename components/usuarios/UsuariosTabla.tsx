import { Icon } from "@/components/Icon";
import { TIPOS_USUARIO } from "@/lib/roles";
import { TIPO_META } from "@/lib/constants/usuarios";
import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuariosTabla({ u }: { u: UsuariosController }) {
  return (
    <div style={s.tableWrapper}>
      <table style={{ ...s.table, minWidth: 820 }}>
        <thead>
          <tr style={{ background: "var(--surface2)" }}>
            <th style={s.th}>Usuario</th>
            <th style={s.th}>Correo</th>
            <th style={s.th}>Teléfono</th>
            <th style={s.th}>Rol</th>
            <th style={{ ...s.th, textAlign: "center" }}>Estado</th>
            <th style={{ ...s.th, textAlign: "center" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {u.usuarios.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{ ...s.td, textAlign: "center", padding: "3rem", color: "var(--muted)" }}
              >
                {u.loading ? "Cargando…" : "No se encontraron usuarios."}
              </td>
            </tr>
          ) : (
            u.usuarios.map((usuario) => {
              const meta = TIPO_META[usuario.tipo_usuario] ?? TIPO_META.EMPLEADO;
              const esMismoUsuario = usuario.id_usuario === u.usuario?.id_usuario;
              return (
                <tr
                  key={usuario.id_usuario}
                  style={{
                    borderTop: "1px solid var(--border)",
                    opacity: usuario.estado_usuario ? 1 : 0.5,
                  }}
                >
                  <td style={s.td}>
                    <div style={{ fontWeight: 600 }}>{usuario.nombre}</div>
                    {esMismoUsuario && (
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--accent)",
                          fontWeight: 600,
                          marginTop: "0.1rem",
                        }}
                      >
                        (tu cuenta)
                      </div>
                    )}
                  </td>
                  <td style={{ ...s.td, color: "var(--muted)", fontSize: "0.85rem" }}>
                    {usuario.correo}
                  </td>
                  <td style={{ ...s.td, color: "var(--muted)", fontSize: "0.85rem" }}>
                    {usuario.telefono || "—"}
                  </td>
                  <td style={s.td}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.18rem 0.6rem",
                        borderRadius: 99,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      {meta.label}
                    </span>
                    {usuario.tipo_usuario === TIPOS_USUARIO.BODEGUERO && (
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        {usuario.nombre_bodega || "Sin bodega"}
                      </div>
                    )}
                    {usuario.tipo_usuario === TIPOS_USUARIO.EMPLEADO && !usuario.requiere_2fa && (
                      <div style={{ fontSize: "0.7rem", color: "var(--red)", marginTop: "0.25rem" }}>
                        Sin 2FA
                      </div>
                    )}
                  </td>
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.15rem 0.55rem",
                        borderRadius: 99,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: usuario.estado_usuario
                          ? "rgba(63,185,80,.12)"
                          : "rgba(139,148,158,.1)",
                        color: usuario.estado_usuario ? "var(--green)" : "var(--muted)",
                        border: `1px solid ${
                          usuario.estado_usuario
                            ? "rgba(63,185,80,.3)"
                            : "rgba(139,148,158,.2)"
                        }`,
                      }}
                    >
                      {usuario.estado_usuario ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => u.abrirEditar(usuario)}
                        style={s.btnEdit}
                        title="Editar rol y estado"
                        disabled={esMismoUsuario}
                      >
                        <Icon name="pencil" />
                      </button>
                      {usuario.tipo_usuario !== TIPOS_USUARIO.DUENO && !u.limiteDuenosAlcanzado && (
                        <button
                          type="button"
                          onClick={() => u.abrirPromover(usuario)}
                          style={s.btnEdit}
                          disabled={esMismoUsuario || !usuario.estado_usuario}
                          title={
                            !usuario.estado_usuario
                              ? "No se puede promover a un usuario inactivo"
                              : "Promover a Dueño (requiere verificación por correo)"
                          }
                        >
                          <Icon name="owner" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => u.setConfirmToggle(usuario)}
                        disabled={
                          esMismoUsuario || u.toggling || (!usuario.estado_usuario && u.cupoLleno(usuario.tipo_usuario))
                        }
                        style={{
                          ...s.btnToggle,
                          background: usuario.estado_usuario
                            ? "rgba(248,81,73,.1)"
                            : "rgba(63,185,80,.1)",
                          borderColor: usuario.estado_usuario
                            ? "rgba(248,81,73,.25)"
                            : "rgba(63,185,80,.25)",
                        }}
                        title={
                          usuario.estado_usuario
                            ? "Desactivar cuenta"
                            : u.cupoLleno(usuario.tipo_usuario)
                            ? `No se puede activar: el límite de ${(TIPO_META[usuario.tipo_usuario]?.label ?? "").toLowerCase()} está lleno`
                            : "Activar cuenta"
                        }
                      >
                        {usuario.estado_usuario ? "⏸" : "▶"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
