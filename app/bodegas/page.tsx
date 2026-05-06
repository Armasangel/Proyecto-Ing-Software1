"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";

type Bodega = {
  id_bodega: number;
  nombre_bodega: string;
  ubicacion: string | null;
  total_productos: number;
  stock_total: string | number;
};

const EMPTY_FORM = { nombre_bodega: "", ubicacion: "" };

export default function BodegasPage() {
  const usuario = useDuenoSession();

  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Bodega | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Confirm delete
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const cargarBodegas = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bodegas");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar bodegas");
      setBodegas(d.bodegas || []);
    } catch (e) {
      showToast(String(e), "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    cargarBodegas();
  }, [usuario, cargarBodegas]);

  // Modal helpers
  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  const abrirEditar = (b: Bodega) => {
    setEditando(b);
    setForm({ nombre_bodega: b.nombre_bodega, ubicacion: b.ubicacion ?? "" });
    setFormError("");
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setFormError("");
  };

  const handleGuardar = async () => {
    if (!form.nombre_bodega.trim()) {
      setFormError("El nombre de la bodega es obligatorio");
      return;
    }
    setSaving(true);
    setFormError("");

    const url = editando
      ? `/api/bodegas/${editando.id_bodega}`
      : "/api/bodegas";
    const method = editando ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_bodega: form.nombre_bodega.trim(),
          ubicacion: form.ubicacion.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Error al guardar");
      } else {
        cerrarModal();
        cargarBodegas();
        showToast(editando ? "Bodega actualizada ✓" : "Bodega creada ✓", "ok");
      }
    } catch {
      setFormError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/bodegas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Error al eliminar", "err");
      } else {
        showToast("Bodega eliminada ✓", "ok");
        cargarBodegas();
      }
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  };

  if (!usuario) {
    return (
      <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>
    );
  }

  const subtitulo = loading
    ? "Cargando…"
    : `${bodegas.length} bodega${bodegas.length !== 1 ? "s" : ""} registrada${bodegas.length !== 1 ? "s" : ""}`;

  return (
    <StaffShell usuario={usuario} title="Bodegas" subtitle={subtitulo}>
      {/* ── Header actions ── */}
      <div style={s.headerActions}>
        <button type="button" onClick={abrirCrear} style={s.btnPrimary}>
          + Nueva bodega
        </button>
        <button
          type="button"
          onClick={() => cargarBodegas()}
          style={s.btnGhost}
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* ── Cards grid ── */}
      {bodegas.length === 0 && !loading ? (
        <div style={s.empty}>
          <span style={{ fontSize: "2.5rem" }}>🏭</span>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            No hay bodegas registradas todavía.
          </p>
          <button type="button" onClick={abrirCrear} style={{ ...s.btnPrimary, marginTop: "1rem" }}>
            Crear primera bodega
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {bodegas.map((b) => (
            <div key={b.id_bodega} style={s.card}>
              {/* Card header */}
              <div style={s.cardHeader}>
                <div style={s.cardIcon}>🏭</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={s.cardTitle}>{b.nombre_bodega}</h3>
                  <p style={s.cardSub}>
                    {b.ubicacion || (
                      <span style={{ fontStyle: "italic" }}>Sin ubicación</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div style={s.statsRow}>
                <div style={s.stat}>
                  <span style={s.statVal}>{b.total_productos}</span>
                  <span style={s.statLabel}>
                    producto{b.total_productos !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={s.statDivider} />
                <div style={s.stat}>
                  <span style={s.statVal}>
                    {Number(b.stock_total).toLocaleString("es-GT", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span style={s.statLabel}>unidades en stock</span>
                </div>
              </div>

              {/* Low-stock indicator */}
              {Number(b.stock_total) === 0 && b.total_productos > 0 && (
                <div style={s.alertBanner}>⚠ Stock en cero</div>
              )}

              {/* Actions */}
              <div style={s.cardActions}>
                <button
                  type="button"
                  onClick={() => abrirEditar(b)}
                  style={s.btnEdit}
                >
                  ✏ Editar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(b.id_bodega)}
                  style={s.btnDel}
                >
                  🗑 Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table (secondary view for many bodegas) ── */}
      {bodegas.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={s.sectionTitle}>Resumen tabular</h2>
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>ID</th>
                  <th style={s.th}>Nombre</th>
                  <th style={s.th}>Ubicación</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Productos</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Stock total</th>
                  <th style={{ ...s.th, textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bodegas.map((b, i) => (
                  <tr
                    key={b.id_bodega}
                    style={{
                      background:
                        i % 2 === 0 ? "var(--surface2)" : "var(--surface)",
                    }}
                  >
                    <td style={{ ...s.td, color: "var(--muted)", fontFamily: "monospace" }}>
                      #{b.id_bodega}
                    </td>
                    <td style={{ ...s.td, fontWeight: 600 }}>
                      {b.nombre_bodega}
                    </td>
                    <td style={{ ...s.td, color: "var(--muted)" }}>
                      {b.ubicacion || "—"}
                    </td>
                    <td style={{ ...s.td, textAlign: "right" }}>
                      {b.total_productos}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Number(b.stock_total).toLocaleString("es-GT", {
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={() => abrirEditar(b)}
                          style={s.iconBtn}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(b.id_bodega)}
                          style={{ ...s.iconBtn, ...s.iconBtnDanger }}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal crear / editar ── */}
      {modalOpen && (
        <div
          style={s.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModal();
          }}
        >
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                {editando ? "Editar bodega" : "Nueva bodega"}
              </h2>
              <button type="button" onClick={cerrarModal} style={s.closeBtn}>
                ✕
              </button>
            </div>

            <div style={s.modalBody}>
              <div style={s.field}>
                <label style={s.label}>Nombre *</label>
                <input
                  style={s.input}
                  value={form.nombre_bodega}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre_bodega: e.target.value }))
                  }
                  placeholder="Bodega Principal"
                  autoFocus
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Ubicación</label>
                <input
                  style={s.input}
                  value={form.ubicacion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ubicacion: e.target.value }))
                  }
                  placeholder="Zona 1, Guatemala"
                />
              </div>

              {formError && <p style={s.formError}>{formError}</p>}
            </div>

            <div style={s.modalFooter}>
              <button
                type="button"
                onClick={cerrarModal}
                style={s.btnSecondary}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardar}
                style={s.btnPrimary}
                disabled={saving}
              >
                {saving
                  ? "Guardando…"
                  : editando
                  ? "Guardar cambios"
                  : "Crear bodega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmId !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>¿Eliminar bodega?</h2>
            </div>
            <div style={s.modalBody}>
              <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                Solo se puede eliminar si la bodega{" "}
                <strong style={{ color: "var(--text)" }}>
                  no tiene stock activo
                </strong>
                . Si tiene productos con existencias, transfiere o ajusta el
                inventario primero desde{" "}
                <strong style={{ color: "var(--text)" }}>
                  Gestión de inventario
                </strong>
                .
              </p>
            </div>
            <div style={s.modalFooter}>
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                style={s.btnSecondary}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleEliminar(confirmId)}
                style={{ ...s.btnPrimary, background: "var(--red)" }}
                disabled={deleting}
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
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
            color:
              toast.tipo === "ok" ? "var(--green)" : "var(--red)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </StaffShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  headerActions: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "1.75rem",
    flexWrap: "wrap",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "#0d1117",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "0.6rem 1.2rem",
    fontFamily: "var(--font-head)",
    fontSize: "0.88rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "var(--radius)",
    padding: "0.6rem 1rem",
    cursor: "pointer",
    fontSize: "0.88rem",
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

  // Cards
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "1rem",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    transition: "border-color .15s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.85rem",
  },
  cardIcon: {
    fontSize: "1.75rem",
    lineHeight: 1,
    flexShrink: 0,
    background: "rgba(45,106,79,.15)",
    borderRadius: 10,
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    margin: 0,
    fontFamily: "var(--font-head)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardSub: {
    margin: "0.2rem 0 0",
    fontSize: "0.8rem",
    color: "var(--muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.75rem",
    background: "var(--surface2)",
    borderRadius: 10,
  },
  stat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.2rem",
  },
  statVal: {
    fontSize: "1.4rem",
    fontFamily: "var(--font-head)",
    fontWeight: 700,
    color: "var(--accent)",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "0.72rem",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  statDivider: {
    width: 1,
    height: 32,
    background: "var(--border)",
    flexShrink: 0,
  },
  alertBanner: {
    background: "rgba(232,160,69,.12)",
    border: "1px solid rgba(232,160,69,.3)",
    borderRadius: 8,
    padding: "0.45rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--accent)",
  },
  cardActions: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "auto",
  },
  btnEdit: {
    flex: 1,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.5rem",
    color: "var(--text)",
    fontSize: "0.82rem",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
  },
  btnDel: {
    flex: 1,
    background: "rgba(248,81,73,.08)",
    border: "1px solid rgba(248,81,73,.25)",
    borderRadius: 8,
    padding: "0.5rem",
    color: "var(--red)",
    fontSize: "0.82rem",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
  },

  // Empty state
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4rem 2rem",
    background: "var(--surface)",
    border: "1px dashed var(--border)",
    borderRadius: 14,
    maxWidth: 420,
  },

  // Section title
  sectionTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "0.75rem",
  },

  // Table
  tableWrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    background: "var(--surface2)",
    color: "var(--muted)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    padding: "0.75rem 1rem",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "0.75rem 1rem",
    color: "var(--text)",
    fontSize: "0.88rem",
    verticalAlign: "middle",
    borderBottom: "1px solid var(--border)",
  },
  iconBtn: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  iconBtnDanger: {
    background: "rgba(248,81,73,.1)",
    border: "1px solid rgba(248,81,73,.25)",
  },

  // Modal
  overlay: {
    position: "fixed",
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
    maxWidth: 480,
    boxShadow: "var(--shadow)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid var(--border)",
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
    flexDirection: "column",
    gap: "1rem",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid var(--border)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  label: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "var(--muted)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  input: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.65rem 0.85rem",
    color: "var(--text)",
    fontSize: "0.92rem",
    outline: "none",
    width: "100%",
  },
  formError: {
    color: "var(--red)",
    fontSize: "0.85rem",
    margin: 0,
  },

  // Toast
  toast: {
    position: "fixed",
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