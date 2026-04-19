"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

interface Categoria { id_categoria: number; nombre_categoria: string; }
interface Marca      { id_marca: number;     nombre_marca: string; }
interface Usuario    { id_usuario: number; nombre: string; correo: string; tipo_usuario: string; }

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
  const router = useRouter();

  const [usuario,    setUsuario]    = useState<Usuario | null>(null);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas,     setMarcas]     = useState<Marca[]>([]);

  const [busqueda,   setBusqueda]   = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  // Modal
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editando,   setEditando]   = useState<Producto | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");

  // Confirm delete
  const [confirmId,  setConfirmId]  = useState<number | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  // Carga inicial 
  const cargarProductos = useCallback(() => {
    fetch("/api/productos")
      .then(r => r.json())
      .then(d => setProductos(d.productos || []));
  }, []);

  useEffect(() => {
    fetch("/api/sesion")
      .then(r => r.json())
      .then(d => {
        if (!d.usuario) { router.replace("/login"); return; }
        setUsuario(d.usuario);
      });

    cargarProductos();

    fetch("/api/categorias").then(r => r.json()).then(d => setCategorias(d.categorias || []));
    fetch("/api/marcas").then(r => r.json()).then(d => setMarcas(d.marcas || []));
  }, [router, cargarProductos]);

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
      precio_mayoreo:  p.precio_mayoreo  ?? "",
      unidad_medida:   p.unidad_medida,
      id_categoria:    String(p.id_categoria),
      id_marca:        String(p.id_marca),
      caducidad:       p.caducidad,
      exento_iva:      p.exento_iva,
      estado_producto: p.estado_producto,
    });
    setFormError("");
    setModalOpen(true);
  };

  const cerrarModal = () => { setModalOpen(false); setEditando(null); };

  // Guardar (crear o editar) 
  const handleGuardar = async () => {
    if (!form.codigo_producto || !form.nombre_producto || !form.unidad_medida ||
        !form.id_categoria || !form.id_marca) {
      setFormError("Completa todos los campos obligatorios (*)");
      return;
    }

    setSaving(true);
    setFormError("");

    const url    = editando ? `/api/productos/${editando.id_producto}` : "/api/productos";
    const method = editando ? "PUT" : "POST";

    const payload = {
      ...form,
      precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
      precio_mayoreo:  form.precio_mayoreo  ? Number(form.precio_mayoreo)  : null,
      id_categoria:    Number(form.id_categoria),
      id_marca:        Number(form.id_marca),
    };

    try {
      const res  = await fetch(url, {
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
      const res  = await fetch(`/api/productos/${id}`, { method: "DELETE" });
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
    return <div style={{ padding: "2rem", color: "var(--muted)", fontFamily: "var(--font-body)" }}>Cargando…</div>;
  }

  const esDueno    = usuario.tipo_usuario === "DUENO";
  const verPrecios = esDueno || usuario.tipo_usuario === "EMPLEADO";

  const productosFiltrados = productos.filter(p => {
    if (soloActivos && !p.estado_producto) return false;
    const q = busqueda.toLowerCase();
    return (
      p.nombre_producto.toLowerCase().includes(q) ||
      p.codigo_producto.toLowerCase().includes(q) ||
      p.nombre_categoria.toLowerCase().includes(q) ||
      p.nombre_marca.toLowerCase().includes(q)
    );
  });
  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <main style={s.main}>
      {/* ── Header ── */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.titulo}>Inventario</h1>
          <p style={s.subtitulo}>
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
            {!soloActivos ? " (incluyendo inactivos)" : ""}
          </p>
        </div>
        <div style={s.headerActions}>
          <input
            type="text"
            placeholder="Buscar producto, código, categoría…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={s.searchInput}
          />
          <label style={s.checkLabel}>
            <input
              type="checkbox"
              checked={!soloActivos}
              onChange={e => setSoloActivos(!e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Ver inactivos
          </label>
          {esDueno && (
            <button onClick={abrirCrear} style={s.btnPrimary}>
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
                <td colSpan={esDueno ? (verPrecios ? 9 : 7) : (verPrecios ? 8 : 6)}
                    style={{ ...s.td, textAlign: "center", color: "var(--muted)", padding: "3rem" }}>
                  No se encontraron productos.
                </td>
              </tr>
            ) : (
              productosFiltrados.map(p => (
                <tr key={p.id_producto} style={{
                  ...s.tr,
                  opacity: p.estado_producto ? 1 : 0.5,
                }}>
                  <td style={s.td}>
                    <code style={s.code}>{p.codigo_producto}</code>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 500 }}>{p.nombre_producto}</span>
                    <span style={s.badges}>
                      {p.caducidad   && <span style={s.badge}>Caduca</span>}
                      {p.exento_iva  && <span style={{ ...s.badge, background: "rgba(88,166,255,.15)", color: "var(--blue)", borderColor: "rgba(88,166,255,.3)" }}>Exento IVA</span>}
                    </span>
                  </td>
                  <td style={s.td}>{p.nombre_categoria}</td>
                  <td style={s.td}>{p.nombre_marca}</td>
                  <td style={s.td}>{p.unidad_medida}</td>
                  {verPrecios && (
                    <>
                      <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {p.precio_unitario ? `Q${Number(p.precio_unitario).toFixed(2)}` : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {p.precio_mayoreo ? `Q${Number(p.precio_mayoreo).toFixed(2)}` : "—"}
                      </td>
                    </>
                  )}
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <span style={{
                      ...s.statusBadge,
                      background: p.estado_producto ? "rgba(63,185,80,.15)"  : "rgba(139,148,158,.1)",
                      color:      p.estado_producto ? "var(--green)"          : "var(--muted)",
                      borderColor: p.estado_producto ? "rgba(63,185,80,.3)"   : "rgba(139,148,158,.2)",
                    }}>
                      {p.estado_producto ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {esDueno && (
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <div style={s.actionBtns}>
                        <button onClick={() => abrirEditar(p)} style={s.btnEdit} title="Editar">✏️</button>
                        <button onClick={() => setConfirmId(p.id_producto)} style={s.btnDel}  title="Eliminar">🗑️</button>
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
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editando ? "Editar producto" : "Nuevo producto"}</h2>
              <button onClick={cerrarModal} style={s.closeBtn}>✕</button>
            </div>
 
            <div style={s.modalBody}>
              {/* Fila 1: código + nombre */}
              <div style={s.fila}>
                <Field label="Código *" style={{ flex: "0 0 140px" }}>
                  <input
                    style={s.input}
                    value={form.codigo_producto}
                    onChange={e => setForm(f => ({ ...f, codigo_producto: e.target.value }))}
                    placeholder="ARR-001"
                  />
                </Field>
                <Field label="Nombre del producto *" style={{ flex: 1 }}>
                  <input
                    style={s.input}
                    value={form.nombre_producto}
                    onChange={e => setForm(f => ({ ...f, nombre_producto: e.target.value }))}
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
                    onChange={e => setForm(f => ({ ...f, id_categoria: e.target.value }))}
                  >
                    <option value="">— Selecciona —</option>
                    {categorias.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Marca *" style={{ flex: 1 }}>
                  <select
                    style={s.input}
                    value={form.id_marca}
                    onChange={e => setForm(f => ({ ...f, id_marca: e.target.value }))}
                  >
                    <option value="">— Selecciona —</option>
                    {marcas.map(m => (
                      <option key={m.id_marca} value={m.id_marca}>{m.nombre_marca}</option>
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
                    onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))}
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
                    onChange={e => setForm(f => ({ ...f, precio_mayoreo: e.target.value }))}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Unidad de medida *" style={{ flex: 1 }}>
                  <input
                    style={s.input}
                    value={form.unidad_medida}
                    onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}
                    placeholder="libra, litro, unidad…"
                  />
                </Field>
              </div>
 
              {/* Fila 4: checkboxes */}
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <CheckField
                  label="Producto con fecha de caducidad"
                  checked={form.caducidad}
                  onChange={v => setForm(f => ({ ...f, caducidad: v }))}
                />
                <CheckField
                  label="Exento de IVA"
                  checked={form.exento_iva}
                  onChange={v => setForm(f => ({ ...f, exento_iva: v }))}
                />
                <CheckField
                  label="Producto activo"
                  checked={form.estado_producto}
                  onChange={v => setForm(f => ({ ...f, estado_producto: v }))}
                />
              </div>
 
              {formError && <p style={s.formError}>{formError}</p>}
            </div>
 
            <div style={s.modalFooter}>
              <button onClick={cerrarModal} style={s.btnSecondary} disabled={saving}>
                Cancelar
              </button>
              <button onClick={handleGuardar} style={s.btnPrimary} disabled={saving}>
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
                Si el producto tiene historial (kardex o ventas), será <strong style={{ color: "var(--text)" }}>desactivado</strong> en lugar de eliminado para conservar el registro.
              </p>
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setConfirmId(null)} style={s.btnSecondary} disabled={deleting}>
                Cancelar
              </button>
              <button
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
        <div style={{
          ...s.toast,
          background: toast.tipo === "ok" ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)",
          borderColor: toast.tipo === "ok" ? "rgba(63,185,80,.4)"  : "rgba(248,81,73,.4)",
          color:       toast.tipo === "ok" ? "var(--green)"         : "var(--red)",
        }}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}
 
// ─── Sub-componentes ──────────────────────────────────────────────────────────
 
function Field({ label, children, style }: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", ...style }}>
      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
 
function CheckField({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "var(--text)", fontSize: "0.88rem" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}