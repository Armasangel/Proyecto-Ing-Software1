"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";
import { TIPOS_USUARIO } from "@/lib/roles";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Usuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  tipo_usuario: string;
  estado_usuario: boolean;
};

type TipoUsuario = keyof typeof TIPOS_USUARIO;

const TIPO_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  DUENO: {
    label: "Dueño",
    color: "var(--accent)",
    bg: "rgba(232,160,69,.15)",
    border: "rgba(232,160,69,.4)",
  },
  EMPLEADO: {
    label: "Colaborador",
    color: "var(--blue)",
    bg: "rgba(88,166,255,.12)",
    border: "rgba(88,166,255,.35)",
  },
  COMPRADOR: {
    label: "Comprador",
    color: "var(--green)",
    bg: "rgba(63,185,80,.12)",
    border: "rgba(63,185,80,.35)",
  },
  COMPRADOR_MAYOR: {
    label: "Comprador mayorista",
    color: "#c084fc",
    bg: "rgba(192,132,252,.12)",
    border: "rgba(192,132,252,.35)",
  },
};

const TIPOS_OPCIONES: { value: string; label: string }[] = [
  { value: "", label: "Todos los roles" },
  { value: TIPOS_USUARIO.DUENO, label: "Dueño" },
  { value: TIPOS_USUARIO.EMPLEADO, label: "Colaborador" },
];

const EMPTY_FORM = {
  nombre: "",
  correo: "",
  telefono: "",
  contrasena: "",
  tipo_usuario: TIPOS_USUARIO.COMPRADOR,
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UsuariosPage() {
  const usuario = useDuenoSession();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  // Modal edición de rol/estado
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [editTipo, setEditTipo] = useState("");
  const [editEstado, setEditEstado] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Modal nuevo usuario
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoForm, setNuevoForm] = useState({ ...EMPTY_FORM });
  const [savingNuevo, setSavingNuevo] = useState(false);
  const [nuevoError, setNuevoError] = useState("");

  // Confirm toggle estado
  const [confirmToggle, setConfirmToggle] = useState<Usuario | null>(null);
  const [toggling, setToggling] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Carga ──────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set("q", busqueda.trim());
      if (filtroTipo) params.set("tipo", filtroTipo);
      const r = await fetch(`/api/usuarios?${params}`);
      const d = await r.json();
      if (r.ok) setUsuarios(d.usuarios || []);
      else showToast(d.error || "Error al cargar usuarios", "err");
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setLoading(false);
    }
  }, [busqueda, filtroTipo]);

  useEffect(() => {
    if (!usuario) return;
    cargar();
  }, [usuario, cargar]);

  // ── Editar rol/estado ──────────────────────────────────────────────────────

  const abrirEditar = (u: Usuario) => {
    setEditando(u);
    setEditTipo(u.tipo_usuario);
    setEditEstado(u.estado_usuario);
    setEditError("");
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const r = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: editando.id_usuario,
          tipo_usuario: editTipo,
          estado_usuario: editEstado,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setEditError(d.error || "Error al guardar");
      } else {
        setEditando(null);
        showToast("Usuario actualizado ✓", "ok");
        cargar();
      }
    } catch {
      setEditError("Error de conexión");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Toggle estado rápido ───────────────────────────────────────────────────

  const toggleEstado = async (u: Usuario) => {
    setToggling(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: u.id_usuario,
          estado_usuario: !u.estado_usuario,
        }),
      });
      const d = await r.json();
      if (!r.ok) showToast(d.error || "Error", "err");
      else {
        showToast(
          `Cuenta ${!u.estado_usuario ? "activada" : "desactivada"} ✓`,
          "ok"
        );
        cargar();
      }
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setToggling(false);
      setConfirmToggle(null);
    }
  };

  // ── Crear usuario ──────────────────────────────────────────────────────────

  const crearUsuario = async () => {
    setNuevoError("");

    // Validación de correo antes de llamar a la API
    const correoTrimmed = nuevoForm.correo.trim();
    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoTrimmed);
    if (!correoValido) {
      setNuevoError("El correo no es válido. Debe incluir \"@\" y un dominio (ej: nombre@empresa.com)");
      return;
    }

    setSavingNuevo(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoForm),
      });
      const d = await r.json();
      if (!r.ok) {
        setNuevoError(d.error || "Error al crear usuario");
      } else {
        setModalNuevo(false);
        setNuevoForm({ ...EMPTY_FORM });
        showToast("Usuario creado ✓", "ok");
        cargar();
      }
    } catch {
      setNuevoError("Error de conexión");
    } finally {
      setSavingNuevo(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!usuario)
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;

  // Validación en tiempo real del correo del formulario nuevo
  const correoNuevoValido =
    nuevoForm.correo.trim() === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoForm.correo.trim());
  const correoNuevoCompleto = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoForm.correo.trim());

  const totalPorTipo = TIPOS_OPCIONES.slice(1).map((t) => ({
    ...t,
    count: usuarios.filter((u) => u.tipo_usuario === t.value).length,
  }));

  return (
    <StaffShell
      usuario={usuario}
      title="Gestión de usuarios"
      subtitle={`${usuarios.length} usuario${usuarios.length !== 1 ? "s" : ""} encontrado${usuarios.length !== 1 ? "s" : ""}`}
    >
      {/* ── Resumen por tipo ── */}
      <div style={s.statsGrid}>
        {totalPorTipo.map((t) => {
          const meta = TIPO_META[t.value];
          return (
            <div key={t.value} style={s.statCard}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: meta.color,
                  marginBottom: "0.5rem",
                }}
              />
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: meta.color, fontFamily: "var(--font-head)" }}>
                {t.count}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{t.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Barra de herramientas ── */}
      <div style={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar por nombre o correo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={s.searchInput}
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          style={s.select}
        >
          {TIPOS_OPCIONES.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => cargar()} style={s.btnGhost} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setNuevoForm({ ...EMPTY_FORM });
            setNuevoError("");
            setModalNuevo(true);
          }}
          style={s.btnPrimary}
        >
          + Nuevo usuario
        </button>
      </div>

      {/* ── Tabla ── */}
      <div style={s.tableWrapper}>
        <table style={s.table}>
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
            {usuarios.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ ...s.td, textAlign: "center", padding: "3rem", color: "var(--muted)" }}
                >
                  {loading ? "Cargando…" : "No se encontraron usuarios."}
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                const meta = TIPO_META[u.tipo_usuario] ?? TIPO_META.COMPRADOR;
                const esMismoUsuario = u.id_usuario === usuario.id_usuario;
                return (
                  <tr
                    key={u.id_usuario}
                    style={{
                      borderTop: "1px solid var(--border)",
                      opacity: u.estado_usuario ? 1 : 0.5,
                    }}
                  >
                    <td style={s.td}>
                      <div style={{ fontWeight: 600 }}>{u.nombre}</div>
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
                      {u.correo}
                    </td>
                    <td style={{ ...s.td, color: "var(--muted)", fontSize: "0.85rem" }}>
                      {u.telefono || "—"}
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
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.55rem",
                          borderRadius: 99,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: u.estado_usuario
                            ? "rgba(63,185,80,.12)"
                            : "rgba(139,148,158,.1)",
                          color: u.estado_usuario ? "var(--green)" : "var(--muted)",
                          border: `1px solid ${
                            u.estado_usuario
                              ? "rgba(63,185,80,.3)"
                              : "rgba(139,148,158,.2)"
                          }`,
                        }}
                      >
                        {u.estado_usuario ? "Activo" : "Inactivo"}
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
                          onClick={() => abrirEditar(u)}
                          style={s.btnEdit}
                          title="Editar rol y estado"
                          disabled={esMismoUsuario}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmToggle(u)}
                          disabled={esMismoUsuario || toggling}
                          style={{
                            ...s.btnToggle,
                            background: u.estado_usuario
                              ? "rgba(248,81,73,.1)"
                              : "rgba(63,185,80,.1)",
                            borderColor: u.estado_usuario
                              ? "rgba(248,81,73,.25)"
                              : "rgba(63,185,80,.25)",
                          }}
                          title={u.estado_usuario ? "Desactivar cuenta" : "Activar cuenta"}
                        >
                          {u.estado_usuario ? "⏸" : "▶"}
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

      {/* ── Modal editar rol/estado ── */}
      {editando && (
        <div
          style={s.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditando(null);
          }}
        >
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Editar usuario</h2>
              <button
                type="button"
                onClick={() => setEditando(null)}
                style={s.closeBtn}
              >
                ✕
              </button>
            </div>
            <div style={s.modalBody}>
              {/* Info del usuario */}
              <div style={s.userInfoBox}>
                <div style={{ fontWeight: 700, color: "var(--text)" }}>
                  {editando.nombre}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  {editando.correo}
                </div>
              </div>

              {/* Selector de rol */}
              <div style={s.field}>
                <label style={s.label}>Rol / Tipo de usuario</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {Object.entries(TIPO_META).map(([val, meta]) => {
                    const activo = editTipo === val;
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
                          cursor: "pointer",
                          transition: "all .15s",
                        }}
                      >
                        <input
                          type="radio"
                          name="tipo_usuario"
                          value={val}
                          checked={activo}
                          onChange={() => setEditTipo(val)}
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
                            {rolDescripcion(val)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Estado */}
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
                          editEstado === val
                            ? val
                              ? "rgba(63,185,80,.4)"
                              : "rgba(248,81,73,.4)"
                            : "var(--border)"
                        }`,
                        background:
                          editEstado === val
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
                        checked={editEstado === val}
                        onChange={() => setEditEstado(val)}
                        style={{
                          accentColor: val ? "var(--green)" : "var(--red)",
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          color:
                            editEstado === val
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

              {editError && <div style={s.errorBox}>{editError}</div>}
            </div>
            <div style={s.modalFooter}>
              <button
                type="button"
                onClick={() => setEditando(null)}
                style={s.btnSecondary}
                disabled={savingEdit}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarEdicion}
                style={s.btnPrimary}
                disabled={savingEdit}
              >
                {savingEdit ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nuevo usuario ── */}
      {modalNuevo && (
        <div
          style={s.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalNuevo(false);
          }}
        >
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo usuario</h2>
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                style={s.closeBtn}
              >
                ✕
              </button>
            </div>
            <div style={s.modalBody}>
              <div style={s.field}>
                <label style={s.label}>Nombre completo *</label>
                <input
                  style={s.input}
                  value={nuevoForm.nombre}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  placeholder="Ej: Ana García López"
                  autoFocus
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Correo electrónico *</label>
                <input
                  style={{
                    ...s.input,
                    borderColor: !correoNuevoValido
                      ? "rgba(248,81,73,.6)"
                      : nuevoForm.correo.trim() && correoNuevoCompleto
                      ? "rgba(63,185,80,.5)"
                      : "var(--border)",
                    boxShadow: !correoNuevoValido
                      ? "0 0 0 3px rgba(248,81,73,.1)"
                      : undefined,
                  }}
                  type="text"
                  value={nuevoForm.correo}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, correo: e.target.value }))
                  }
                  placeholder="ana@ejemplo.com"
                />
                {!correoNuevoValido && (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--red)",
                    marginTop: "0.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}>
                    ⚠ El correo debe incluir "@" y un dominio válido
                  </span>
                )}
                {nuevoForm.correo.trim() && correoNuevoCompleto && (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--green)",
                    marginTop: "0.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}>
                    ✓ Formato de correo válido
                  </span>
                )}
              </div>
              <div style={s.field}>
                <label style={s.label}>Teléfono (opcional)</label>
                <input
                  style={s.input}
                  value={nuevoForm.telefono}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, telefono: e.target.value }))
                  }
                  placeholder="5555-1234"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Contraseña inicial *</label>
                <input
                  style={s.input}
                  type="password"
                  value={nuevoForm.contrasena}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, contrasena: e.target.value }))
                  }
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Rol</label>
                <select
                  style={s.input}
                  value={nuevoForm.tipo_usuario}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, tipo_usuario: e.target.value }))
                  }
                >
                  {Object.entries(TIPO_META).map(([val, meta]) => (
                    <option key={val} value={val}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              {nuevoError && <div style={s.errorBox}>{nuevoError}</div>}
            </div>
            <div style={s.modalFooter}>
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                style={s.btnSecondary}
                disabled={savingNuevo}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearUsuario}
                style={s.btnPrimary}
                disabled={savingNuevo || !nuevoForm.nombre || !correoNuevoCompleto || !nuevoForm.contrasena}
              >
                {savingNuevo ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm toggle estado ── */}
      {confirmToggle && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                {confirmToggle.estado_usuario
                  ? "¿Desactivar cuenta?"
                  : "¿Activar cuenta?"}
              </h2>
            </div>
            <div style={s.modalBody}>
              <p style={{ color: "var(--muted)", lineHeight: 1.65 }}>
                {confirmToggle.estado_usuario
                  ? `La cuenta de `
                  : `Se va a activar la cuenta de `}
                <strong style={{ color: "var(--text)" }}>
                  {confirmToggle.nombre}
                </strong>
                {confirmToggle.estado_usuario
                  ? ` quedará inactiva. El usuario no podrá iniciar sesión hasta que la vuelvas a activar.`
                  : `. El usuario podrá volver a iniciar sesión.`}
              </p>
            </div>
            <div style={s.modalFooter}>
              <button
                type="button"
                onClick={() => setConfirmToggle(null)}
                style={s.btnSecondary}
                disabled={toggling}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => toggleEstado(confirmToggle)}
                disabled={toggling}
                style={{
                  ...s.btnPrimary,
                  background: confirmToggle.estado_usuario
                    ? "var(--red)"
                    : "var(--green)",
                }}
              >
                {toggling
                  ? "Procesando…"
                  : confirmToggle.estado_usuario
                  ? "Sí, desactivar"
                  : "Sí, activar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            ...s.toast,
            background:
              toast.tipo === "ok"
                ? "rgba(63,185,80,.15)"
                : "rgba(248,81,73,.15)",
            borderColor:
              toast.tipo === "ok"
                ? "rgba(63,185,80,.4)"
                : "rgba(248,81,73,.4)",
            color: toast.tipo === "ok" ? "var(--green)" : "var(--red)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </StaffShell>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rolDescripcion(tipo: string): string {
  switch (tipo) {
    case "DUENO":
      return "Acceso total: inventario, reportes, estadísticas, usuarios";
    case "EMPLEADO":
      return "Panel de ventas, facturación, productos y bodegas";
    case "COMPRADOR":
      return "Tienda en línea (precios al detalle)";
    case "COMPRADOR_MAYOR":
      return "Portal mayorista: pedidos y catálogo mayoreo";
    default:
      return "";
  }
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1rem 1.25rem",
  },
  toolbar: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "1.25rem",
  },
  searchInput: {
    flex: 1,
    minWidth: 220,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.65rem 1rem",
    color: "var(--text)",
    fontSize: "0.9rem",
    outline: "none",
  },
  select: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.65rem 0.85rem",
    color: "var(--text)",
    fontSize: "0.88rem",
    outline: "none",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.65rem 1rem",
    color: "var(--muted)",
    fontSize: "0.88rem",
    cursor: "pointer",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "#0d1117",
    border: "none",
    borderRadius: 10,
    padding: "0.65rem 1.1rem",
    fontWeight: 700,
    fontSize: "0.88rem",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    fontFamily: "var(--font-head)",
  },
  btnSecondary: {
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.6rem 1.2rem",
    fontSize: "0.88rem",
    cursor: "pointer",
  },
  tableWrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    background: "var(--surface2)",
    color: "var(--muted)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    padding: "0.75rem 1rem",
    textAlign: "left" as const,
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "0.75rem 1rem",
    fontSize: "0.88rem",
    color: "var(--text)",
    verticalAlign: "middle" as const,
  },
  btnEdit: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  btnToggle: {
    border: "1px solid",
    borderRadius: 6,
    padding: "0.3rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,.65)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: "1rem",
  },
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    width: "100%",
    maxWidth: 520,
    boxShadow: "var(--shadow)",
    overflow: "hidden",
    maxHeight: "90vh",
    overflowY: "auto" as const,
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid var(--border)",
    position: "sticky" as const,
    top: 0,
    background: "var(--surface)",
    zIndex: 1,
  },
  modalTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontSize: "1rem",
    cursor: "pointer",
    padding: "0.2rem 0.4rem",
  },
  modalBody: {
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid var(--border)",
    position: "sticky" as const,
    bottom: 0,
    background: "var(--surface)",
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
  },
  label: {
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "var(--muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  input: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.65rem 0.85rem",
    color: "var(--text)",
    fontSize: "0.9rem",
    outline: "none",
    width: "100%",
  },
  userInfoBox: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.85rem 1rem",
  },
  errorBox: {
    background: "rgba(248,81,73,.12)",
    border: "1px solid rgba(248,81,73,.3)",
    borderRadius: 8,
    padding: "0.65rem 0.85rem",
    color: "var(--red)",
    fontSize: "0.85rem",
  },
  toast: {
    position: "fixed" as const,
    bottom: "2rem",
    right: "2rem",
    padding: "0.85rem 1.25rem",
    borderRadius: "var(--radius)",
    border: "1px solid",
    fontSize: "0.88rem",
    fontWeight: 500,
    zIndex: 300,
    backdropFilter: "blur(8px)",
    boxShadow: "var(--shadow)",
  },
};