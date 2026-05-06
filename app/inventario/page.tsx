"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";

// Tipos
interface Producto {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  nombre_categoria: string;
  id_categoria: number;
  nombre_marca: string;
  id_marca: number;
  precio_unitario: string | null;
  precio_mayoreo: string | null;
  unidad_medida: string;
  estado_producto: boolean;
  caducidad: boolean;
  exento_iva: boolean;
}

interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}
interface Marca {
  id_marca: number;
  nombre_marca: string;
}

const EMPTY_FORM = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  id_categoria: "",
  id_marca: "",
  caducidad: false,
  exento_iva: false,
  estado_producto: true,
};

// Componente principal
export default function InventarioPage() {
  const usuario = useDuenoSession();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Confirm delete
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  // Carga inicial
  const cargarProductos = useCallback(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []));
  }, []);

  useEffect(() => {
    if (!usuario) return;
    cargarProductos();
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias || []));
    fetch("/api/marcas")
      .then((r) => r.json())
      .then((d) => setMarcas(d.marcas || []));
  }, [usuario, cargarProductos]);

  // Toast helper
  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // Modal helpers
  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  const abrirEditar = (p: Producto) => {
    setEditando(p);
    setForm({
      codigo_producto: p.codigo_producto,
      nombre_producto: p.nombre_producto,
      precio_unitario: p.precio_unitario ?? "",
      precio_mayoreo: p.precio_mayoreo ?? "",
      unidad_medida: p.unidad_medida,
      id_categoria: String(p.id_categoria),
      id_marca: String(p.id_marca),
      caducidad: p.caducidad,
      exento_iva: p.exento_iva,
      estado_producto: p.estado_producto,
    });
    setFormError("");
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  // Guardar (crear o editar)
  const handleGuardar = async () => {
    if (
      !form.codigo_producto ||
      !form.nombre_producto ||
      !form.unidad_medida ||
      !form.id_categoria ||
      !form.id_marca
    ) {
      setFormError("Completa todos los campos obligatorios (*)");
      return;
    }

    setSaving(true);
    setFormError("");

    const url = editando ? `/api/productos/${editando.id_producto}` : "/api/productos";
    const method = editando ? "PUT" : "POST";

    const payload = {
      ...form,
      precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
      precio_mayoreo: form.precio_mayoreo ? Number(form.precio_mayoreo) : null,
      id_categoria: Number(form.id_categoria),
      id_marca: Number(form.id_marca),
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Error al guardar");
      } else {
        cerrarModal();
        cargarProductos();
        showToast(editando ? "Producto actualizado ✓" : "Producto creado ✓", "ok");
      }
    } catch {
      setFormError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  // Eliminar
  const handleEliminar = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Error al eliminar", "err");
      } else if (data.desactivado) {
        showToast("Producto desactivado (tiene historial)", "ok");
        cargarProductos();
      } else {
        showToast("Producto eliminado ✓", "ok");
        cargarProductos();
      }
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  };

  // Filtros
  if (!usuario) {
    return (
      <div style={{ padding: "2rem", color: "var(--muted)", fontFamily: "var(--font-body)" }}>
        Cargando…
      </div>
    );
  }

  const esDueno = usuario.tipo_usuario === "DUENO";
  const verPrecios = esDueno || usuario.tipo_usuario === "EMPLEADO";

  const productosFiltrados = productos.filter((p) => {
    if (soloActivos && !p.estado_producto) return false;
    const q = busqueda.toLowerCase();
    return (
      p.nombre_producto.toLowerCase().includes(q) ||
      p.codigo_producto.toLowerCase().includes(q) ||
      p.nombre_categoria.toLowerCase().includes(q) ||
      p.nombre_marca.toLowerCase().includes(q)
    );
  });

  const subtituloShell = `${productosFiltrados.length} producto${productosFiltrados.length !== 1 ? "s" : ""}${!soloActivos ? " (incluyendo inactivos)" : ""}`;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <StaffShell usuario={usuario} title="Inventario" subtitle={subtituloShell}>
      <div style={{ ...s.main, padding: 0 }}>
        {/* ── Barra de acciones ── */}
        <div style={{ ...s.pageHeader, justifyContent: "flex-end" }}>
          <div style={s.headerActions}>
            <input
              type="text"
              placeholder="Buscar producto, código, categoría…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={s.searchInput}
            />
            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={!soloActivos}
                onChange={(e) => setSoloActivos(!e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Ver inactivos
            </label>
            {esDueno && (
              <button type="button" onClick={abrirCrear} style={s.btnPrimary}>
                + Nuevo producto
              </button>
            )}
          </div>
        </div>

        {/* ── Tabla ── */}
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Código</th>
                <th style={s.th}>Producto</th>
                <th style={s.th}>Categoría</th>
                <th style={s.th}>Marca</th>
                <th style={s.th}>Unidad</th>
                {verPrecios && (
                  <>
                    <th style={{ ...s.th, textAlign: "right" }}>P. Unit.</th>
                    <th style={{ ...s.th, textAlign: "right" }}>P. Mayor.</th>
                  </>
                )}
                <th style={{ ...s.th, textAlign: "center" }}>Estado</th>
                {esDueno && <th style={{ ...s.th, textAlign: "center" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      esDueno ? (verPrecios ? 9 : 7) : verPrecios ? 8 : 6
                    }
                    style={{
                      ...s.td,
                      textAlign: "center",
                      color: "var(--muted)",
                      padding: "3rem",
                    }}
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <tr
                    key={p.id_producto}
                    style={{
                      ...s.tr,
                      opacity: p.estado_producto ? 1 : 0.5,
                    }}
                  >
                    <td style={s.td}>
                      <code style={s.code}>{p.codigo_producto}</code>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 500 }}>{p.nombre_producto}</span>
                      <span style={s.badges}>
                        {p.caducidad && <span style={s.badge}>Caduca</span>}
                        {p.exento_iva && (
                          <span
                            style={{
                              ...s.badge,
                              background: "rgba(88,166,255,.15)",
                              color: "var(--blue)",
                              borderColor: "rgba(88,166,255,.3)",
                            }}
                          >
                            Exento IVA
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={s.td}>{p.nombre_categoria}</td>
                    <td style={s.td}>{p.nombre_marca}</td>
                    <td style={s.td}>{p.unidad_medida}</td>
                    {verPrecios && (
                      <>
                        <td
                          style={{
                            ...s.td,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {p.precio_unitario ? `Q${Number(p.precio_unitario).toFixed(2)}` : "—"}
                        </td>
                        <td
                          style={{
                            ...s.td,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {p.precio_mayoreo ? `Q${Number(p.precio_mayoreo).toFixed(2)}` : "—"}
                        </td>
                      </>
                    )}
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span
                        style={{
                          ...s.statusBadge,
                          background: p.estado_producto
                            ? "rgba(63,185,80,.15)"
                            : "rgba(139,148,158,.1)",
                          color: p.estado_producto ? "var(--green)" : "var(--muted)",
                          borderColor: p.estado_producto
                            ? "rgba(63,185,80,.3)"
                            : "rgba(139,148,158,.2)",
                        }}
                      >
                        {p.estado_producto ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    {esDueno && (
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <div style={s.actionBtns}>
                          <button
                            type="button"
                            onClick={() => abrirEditar(p)}
                            style={s.btnEdit}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(p.id_producto)}
                            style={s.btnDel}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Modal Crear / Editar ── */}
        {modalOpen && (
          <div
            style={s.overlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) cerrarModal();
            }}
          >
            <div style={s.modal}>
              <div style={s.modalHeader}>
                <h2 style={s.modalTitle}>{editando ? "Editar producto" : "Nuevo producto"}</h2>
                <button type="button" onClick={cerrarModal} style={s.closeBtn}>
                  ✕
                </button>
              </div>

              <div style={s.modalBody}>
                {/* Fila 1: código + nombre */}
                <div style={s.fila}>
                  <Field label="Código *" style={{ flex: "0 0 140px" }}>
                    <input
                      style={s.input}
                      value={form.codigo_producto}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, codigo_producto: e.target.value }))
                      }
                      placeholder="ARR-001"
                    />
                  </Field>
                  <Field label="Nombre del producto *" style={{ flex: 1 }}>
                    <input
                      style={s.input}
                      value={form.nombre_producto}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nombre_producto: e.target.value }))
                      }
                      placeholder="Arroz 1 libra"
                    />
                  </Field>
                </div>

                {/* Fila 2: categoría + marca */}
                <div style={s.fila}>
                  <Field label="Categoría *" style={{ flex: 1 }}>
                    <select
                      style={s.input}
                      value={form.id_categoria}
                      onChange={(e) => setForm((f) => ({ ...f, id_categoria: e.target.value }))}
                    >
                      <option value="">— Selecciona —</option>
                      {categorias.map((c) => (
                        <option key={c.id_categoria} value={c.id_categoria}>
                          {c.nombre_categoria}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Marca *" style={{ flex: 1 }}>
                    <select
                      style={s.input}
                      value={form.id_marca}
                      onChange={(e) => setForm((f) => ({ ...f, id_marca: e.target.value }))}
                    >
                      <option value="">— Selecciona —</option>
                      {marcas.map((m) => (
                        <option key={m.id_marca} value={m.id_marca}>
                          {m.nombre_marca}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Fila 3: precios + unidad */}
                <div style={s.fila}>
                  <Field label="Precio unitario" style={{ flex: 1 }}>
                    <input
                      style={s.input}
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.precio_unitario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, precio_unitario: e.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Precio mayoreo" style={{ flex: 1 }}>
                    <input
                      style={s.input}
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.precio_mayoreo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, precio_mayoreo: e.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Unidad de medida *" style={{ flex: 1 }}>
                    <input
                      style={s.input}
                      value={form.unidad_medida}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, unidad_medida: e.target.value }))
                      }
                      placeholder="libra, litro, unidad…"
                    />
                  </Field>
                </div>

                {/* Fila 4: checkboxes */}
                <div
                  style={{
                    display: "flex",
                    gap: "1.5rem",
                    flexWrap: "wrap",
                    marginTop: "0.25rem",
                  }}
                >
                  <CheckField
                    label="Producto con fecha de caducidad"
                    checked={form.caducidad}
                    onChange={(v) => setForm((f) => ({ ...f, caducidad: v }))}
                  />
                  <CheckField
                    label="Exento de IVA"
                    checked={form.exento_iva}
                    onChange={(v) => setForm((f) => ({ ...f, exento_iva: v }))}
                  />
                  <CheckField
                    label="Producto activo"
                    checked={form.estado_producto}
                    onChange={(v) => setForm((f) => ({ ...f, estado_producto: v }))}
                  />
                </div>

                {formError && <p style={s.formError}>{formError}</p>}
              </div>

              <div style={s.modalFooter}>
                <button type="button" onClick={cerrarModal} style={s.btnSecondary} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" onClick={handleGuardar} style={s.btnPrimary} disabled={saving}>
                  {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm delete ── */}
        {confirmId !== null && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, maxWidth: 400 }}>
              <div style={s.modalHeader}>
                <h2 style={s.modalTitle}>¿Eliminar producto?</h2>
              </div>
              <div style={s.modalBody}>
                <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                  Si el producto tiene historial (kardex o ventas), será{" "}
                  <strong style={{ color: "var(--text)" }}>desactivado</strong> en lugar de eliminado
                  para conservar el registro.
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
              background: toast.tipo === "ok" ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)",
              borderColor: toast.tipo === "ok" ? "rgba(63,185,80,.4)" : "rgba(248,81,73,.4)",
              color: toast.tipo === "ok" ? "var(--green)" : "var(--red)",
            }}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </StaffShell>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", ...style }}>
      <label
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        cursor: "pointer",
        color: "var(--text)",
        fontSize: "0.88rem",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

// ─── Estilos

const s: Record<string, CSSProperties> = {
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "2rem 1.5rem",
    fontFamily: "var(--font-body)",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  headerActions: { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  searchInput: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.6rem 1rem",
    color: "var(--text)",
    fontSize: "0.88rem",
    outline: "none",
    width: 260,
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    color: "var(--muted)",
    fontSize: "0.85rem",
    cursor: "pointer",
    userSelect: "none",
  } as CSSProperties,
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
  } as CSSProperties,
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
  } as CSSProperties,
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "0.75rem 1rem", color: "var(--text)", fontSize: "0.88rem", verticalAlign: "middle" },
  code: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "0.1rem 0.4rem",
    fontSize: "0.75rem",
    color: "var(--accent)",
    fontFamily: "monospace",
  },
  badges: { display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" },
  badge: {
    fontSize: "0.65rem",
    padding: "0.05rem 0.4rem",
    borderRadius: 99,
    background: "rgba(232,160,69,.12)",
    color: "var(--accent)",
    border: "1px solid rgba(232,160,69,.25)",
    fontWeight: 600,
    letterSpacing: "0.03em",
  } as CSSProperties,
  statusBadge: {
    display: "inline-block",
    fontSize: "0.72rem",
    padding: "0.15rem 0.6rem",
    borderRadius: 99,
    border: "1px solid",
    fontWeight: 600,
    letterSpacing: "0.04em",
  } as CSSProperties,
  actionBtns: { display: "flex", gap: "0.4rem", justifyContent: "center" },
  btnEdit: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  btnDel: {
    background: "rgba(248,81,73,.1)",
    border: "1px solid rgba(248,81,73,.25)",
    borderRadius: 6,
    padding: "0.3rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.85rem",
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
  } as CSSProperties,
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    width: "100%",
    maxWidth: 620,
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
  } as CSSProperties,
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid var(--border)",
  },
  fila: { display: "flex", gap: "1rem", flexWrap: "wrap" },
  input: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.6rem 0.85rem",
    color: "var(--text)",
    fontSize: "0.9rem",
    outline: "none",
    width: "100%",
  },
  formError: {
    color: "var(--red)",
    fontSize: "0.85rem",
    margin: "0.25rem 0 0",
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
  } as CSSProperties,
};
