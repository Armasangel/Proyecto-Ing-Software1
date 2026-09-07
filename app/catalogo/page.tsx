"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";
import { Icon, type IconName } from "@/components/Icon";

const MIS_ITEMS = [
  {label: "editar", icon: "pencil"},
  {label: "borar", icon: "trash"},
]

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
interface Proveedor {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string | null;
  telefono: string | null;
}
type PresentacionForm = { nombre_presentacion: string; factor_conversion: string };

function matchesQuery(query: string, ...campos: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return campos.some((c) => c != null && String(c).toLowerCase().includes(q));
}

// Mismo heurístico que valida /api/productos en el servidor: por el nombre
// de la unidad de medida detectamos si es un líquido embotellado (requiere
// caja obligatoria) o si se mide en libras (puede ofrecerse como "saco").
const UNIDADES_LIQUIDAS = ["botella", "litro", "lt", "ml", "galon", "galón"];
function esUnidadLiquida(unidad: string): boolean {
  return UNIDADES_LIQUIDAS.some((k) => unidad.trim().toLowerCase().includes(k));
}
function esUnidadLibra(unidad: string): boolean {
  return unidad.trim().toLowerCase().includes("libra");
}

const PROVEEDOR_VACIO = { nombre_proveedor: "", nit_proveedor: "", correo_contacto: "", telefono: "" };

const EMPTY_FORM = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  id_categoria: "",
  id_marca: "",
  caducidad: false,
  fecha_caducidad: "",
  exento_iva: false,
  estado_producto: true,
};

type TabKey = "productos" | "precios";

export default function CatalogoPage() {
  const usuario = useDuenoSession();

  const [tab, setTab] = useState<TabKey>("productos");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  // Modal producto
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Proveedores: buscador + selección múltiple + alta rápida
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorQuery, setProveedorQuery] = useState("");
  const [proveedorSugerenciasAbiertas, setProveedorSugerenciasAbiertas] = useState(false);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<Proveedor[]>([]);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [formProveedorNuevo, setFormProveedorNuevo] = useState(PROVEEDOR_VACIO);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [errorProveedor, setErrorProveedor] = useState("");

  // Categoría / marca: alta rápida sin salir del modal
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState("");
  const [creandoMarca, setCreandoMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState("");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [errorMarca, setErrorMarca] = useState("");

  // Presentaciones por mayor (ej. "Caja de 24", "Saco de 50 libras")
  const [presentacionesForm, setPresentacionesForm] = useState<PresentacionForm[]>([]);

  // Confirm delete
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Precios inline
  const [precioEditando, setPrecioEditando] = useState<number | null>(null);
  const [precioForm, setPrecioForm] = useState({ precio_unitario: "", precio_mayoreo: "" });
  const [savingPrecio, setSavingPrecio] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const cargarProductos = useCallback(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []));
  }, []);

  useEffect(() => {
    if (!usuario) return;
    cargarProductos();
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.categorias || []));
    fetch("/api/marcas").then((r) => r.json()).then((d) => setMarcas(d.marcas || []));
    fetch("/api/proveedores")
      .then((r) => (r.ok ? r.json() : { proveedores: [] }))
      .then((d) => setProveedores(d.proveedores || []))
      .catch(() => setProveedores([]));
  }, [usuario, cargarProductos]);

  const proveedoresFiltrados = proveedores.filter(
    (p) =>
      !proveedoresSeleccionados.some((s) => s.id_proveedor === p.id_proveedor) &&
      matchesQuery(proveedorQuery, p.nombre_proveedor, p.nit_proveedor)
  );

  const liquidoRequiereCaja = esUnidadLiquida(form.unidad_medida);
  const esLibra = esUnidadLibra(form.unidad_medida);
  const presentacionesValidas = presentacionesForm.filter(
    (p) => p.nombre_presentacion.trim() && Number(p.factor_conversion) > 0
  );
  const faltaCajaObligatoria = !editando && liquidoRequiereCaja && presentacionesValidas.length === 0;

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const resetExtras = () => {
    setProveedoresSeleccionados([]);
    setProveedorQuery("");
    setCreandoProveedor(false);
    setFormProveedorNuevo(PROVEEDOR_VACIO);
    setErrorProveedor("");
    setPresentacionesForm([]);
    setCreandoCategoria(false);
    setNuevaCategoriaNombre("");
    setErrorCategoria("");
    setCreandoMarca(false);
    setNuevaMarcaNombre("");
    setErrorMarca("");
  };

  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    resetExtras();
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
      fecha_caducidad: "",
      exento_iva: p.exento_iva,
      estado_producto: p.estado_producto,
    });
    setFormError("");
    resetExtras();
    setModalOpen(true);
  };

  const cerrarModal = () => { setModalOpen(false); setEditando(null); resetExtras(); };

  const agregarProveedor = (p: Proveedor) => {
    setProveedoresSeleccionados((prev) => [...prev, p]);
    setProveedorQuery("");
    setProveedorSugerenciasAbiertas(false);
  };

  const quitarProveedor = (id: number) => {
    setProveedoresSeleccionados((prev) => prev.filter((p) => p.id_proveedor !== id));
  };

  const guardarProveedorNuevo = async () => {
    setErrorProveedor("");
    if (!formProveedorNuevo.nombre_proveedor.trim() || !formProveedorNuevo.nit_proveedor.trim()) {
      setErrorProveedor("Nombre y NIT son obligatorios");
      return;
    }
    setGuardandoProveedor(true);
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formProveedorNuevo),
      });
      const data = await res.json();
      if (!res.ok) setErrorProveedor(data.error || "Error al crear el proveedor");
      else {
        setProveedores((prev) => [...prev, data.proveedor]);
        agregarProveedor(data.proveedor);
        setFormProveedorNuevo(PROVEEDOR_VACIO);
        setCreandoProveedor(false);
      }
    } catch { setErrorProveedor("Error de conexión"); }
    finally { setGuardandoProveedor(false); }
  };

  const guardarCategoriaNueva = async () => {
    setErrorCategoria("");
    if (!nuevaCategoriaNombre.trim()) { setErrorCategoria("El nombre es obligatorio"); return; }
    setGuardandoCategoria(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_categoria: nuevaCategoriaNombre.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setErrorCategoria(data.error || "Error al crear la categoría");
      else {
        setCategorias((prev) => [...prev, data.categoria].sort((a, b) => a.nombre_categoria.localeCompare(b.nombre_categoria)));
        setForm((f) => ({ ...f, id_categoria: String(data.categoria.id_categoria) }));
        setNuevaCategoriaNombre("");
        setCreandoCategoria(false);
      }
    } catch { setErrorCategoria("Error de conexión"); }
    finally { setGuardandoCategoria(false); }
  };

  const guardarMarcaNueva = async () => {
    setErrorMarca("");
    if (!nuevaMarcaNombre.trim()) { setErrorMarca("El nombre es obligatorio"); return; }
    setGuardandoMarca(true);
    try {
      const res = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_marca: nuevaMarcaNombre.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMarca(data.error || "Error al crear la marca");
      else {
        setMarcas((prev) => [...prev, data.marca].sort((a, b) => a.nombre_marca.localeCompare(b.nombre_marca)));
        setForm((f) => ({ ...f, id_marca: String(data.marca.id_marca) }));
        setNuevaMarcaNombre("");
        setCreandoMarca(false);
      }
    } catch { setErrorMarca("Error de conexión"); }
    finally { setGuardandoMarca(false); }
  };

  const agregarFilaPresentacion = (nombrePreset = "") => {
    setPresentacionesForm((prev) => [...prev, { nombre_presentacion: nombrePreset, factor_conversion: "" }]);
  };
  const actualizarPresentacion = (idx: number, campo: keyof PresentacionForm, valor: string) => {
    setPresentacionesForm((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  };
  const quitarPresentacionFila = (idx: number) => {
    setPresentacionesForm((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGuardar = async () => {
    if (!form.codigo_producto || !form.nombre_producto || !form.unidad_medida || !form.id_categoria || !form.id_marca) {
      setFormError("Completa todos los campos obligatorios (*)");
      return;
    }
    if (faltaCajaObligatoria) {
      setFormError("Los productos con unidad líquida (botella, litro, ml, galón) necesitan al menos una presentación tipo caja. Agrégala abajo en \"Presentaciones por mayor\".");
      return;
    }
    setSaving(true);
    setFormError("");
    const url = editando ? `/api/productos/${editando.id_producto}` : "/api/productos";
    const method = editando ? "PUT" : "POST";
    const payload: Record<string, unknown> = {
      ...form,
      precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
      precio_mayoreo: form.precio_mayoreo ? Number(form.precio_mayoreo) : null,
      fecha_caducidad: form.caducidad && form.fecha_caducidad ? form.fecha_caducidad : null,
      id_categoria: Number(form.id_categoria),
      id_marca: Number(form.id_marca),
    };
    if (!editando) {
      payload.id_proveedores = proveedoresSeleccionados.map((p) => p.id_proveedor);
      payload.presentaciones = presentacionesValidas.map((p) => ({
        nombre_presentacion: p.nombre_presentacion.trim(),
        factor_conversion: Number(p.factor_conversion),
      }));
    }
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Error al guardar"); }
      else { cerrarModal(); cargarProductos(); showToast(editando ? "Producto actualizado ✓" : "Producto creado ✓", "ok"); }
    } catch { setFormError("No se pudo conectar con el servidor"); }
    finally { setSaving(false); }
  };

  const handleEliminar = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) showToast(data.error || "Error al eliminar", "err");
      else { showToast(data.desactivado ? "Producto desactivado (tiene historial)" : "Producto eliminado ✓", "ok"); cargarProductos(); }
    } catch { showToast("Error de conexión", "err"); }
    finally { setDeleting(false); setConfirmId(null); }
  };

  // ── Precios inline ─────────────────────────────────────────────────────────
  const iniciarEditarPrecio = (p: Producto) => {
    setPrecioEditando(p.id_producto);
    setPrecioForm({ precio_unitario: p.precio_unitario ?? "", precio_mayoreo: p.precio_mayoreo ?? "" });
  };

  const guardarPrecio = async (id_producto: number) => {
    setSavingPrecio(true);
    try {
      const res = await fetch("/api/precios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_producto, precio_unitario: parseFloat(precioForm.precio_unitario), precio_mayoreo: parseFloat(precioForm.precio_mayoreo) }),
      });
      if (res.ok) { showToast("Precio actualizado ✓", "ok"); setPrecioEditando(null); cargarProductos(); }
      else { const d = await res.json(); showToast(d.error || "Error al actualizar precio", "err"); }
    } catch { showToast("Error de conexión", "err"); }
    finally { setSavingPrecio(false); }
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  if (!usuario) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;

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

  return (
    <StaffShell
      usuario={usuario}
      title="Catálogo"
      subtitle={`${productosFiltrados.length} producto${productosFiltrados.length !== 1 ? "s" : ""}${!soloActivos ? " (incluyendo inactivos)" : ""}`}
    >
      {/* ── Tabs ── */}
      <div style={s.tabRow}>
        {([ ["productos", "Productos"], ["precios", "Precios"] ] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} style={{ ...s.tabBtn, borderColor: tab === k ? "rgba(45,106,79,.55)" : "var(--border)", background: tab === k ? "rgba(45,106,79,.12)" : "transparent", color: tab === k ? "var(--text)" : "var(--muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Barra de búsqueda + acciones ── */}
      <div style={s.toolbar}>
        <input
          type="text"
          placeholder="Buscar producto, código, categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={s.searchInput}
        />
        <label style={s.checkLabel}>
          <input type="checkbox" checked={!soloActivos} onChange={(e) => setSoloActivos(!e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          Ver inactivos
        </label>
        {tab === "productos" && (
          <button type="button" onClick={abrirCrear} style={s.btnPrimary}>+ Nuevo producto</button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PRODUCTOS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "productos" && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Código</th>
                <th style={s.th}>Producto</th>
                <th style={s.th}>Categoría</th>
                <th style={s.th}>Marca</th>
                <th style={s.th}>Unidad</th>
                <th style={{ ...s.th, textAlign: "right" }}>P. Unit.</th>
                <th style={{ ...s.th, textAlign: "right" }}>P. Mayor.</th>
                <th style={{ ...s.th, textAlign: "center" }}>Estado</th>
                <th style={{ ...s.th, textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr><td colSpan={9} style={{ ...s.td, textAlign: "center", color: "var(--muted)", padding: "3rem" }}>No se encontraron productos.</td></tr>
              ) : (
                productosFiltrados.map((p) => (
                  <tr key={p.id_producto} style={{ ...s.tr, opacity: p.estado_producto ? 1 : 0.5 }}>
                    <td style={s.td}><code style={s.code}>{p.codigo_producto}</code></td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 500 }}>{p.nombre_producto}</span>
                      <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                        {p.caducidad && <span style={s.badge}>Caduca</span>}
                        {p.exento_iva && <span style={{ ...s.badge, background: "rgba(88,166,255,.15)", color: "var(--blue)", borderColor: "rgba(88,166,255,.3)" }}>Exento IVA</span>}
                      </div>
                    </td>
                    <td style={s.td}>{p.nombre_categoria}</td>
                    <td style={s.td}>{p.nombre_marca}</td>
                    <td style={s.td}>{p.unidad_medida}</td>
                    <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.precio_unitario ? `Q${Number(p.precio_unitario).toFixed(2)}` : "—"}</td>
                    <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.precio_mayoreo ? `Q${Number(p.precio_mayoreo).toFixed(2)}` : "—"}</td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span style={{ ...s.statusBadge, background: p.estado_producto ? "rgba(63,185,80,.15)" : "rgba(139,148,158,.1)", color: p.estado_producto ? "var(--green)" : "var(--muted)", borderColor: p.estado_producto ? "rgba(63,185,80,.3)" : "rgba(139,148,158,.2)" }}>
                        {p.estado_producto ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                        <button type="button" onClick={() => abrirEditar(p)} style={s.btnEdit} title="Editar"><Icon name ="pencil" variant="dark" size={24}/></button>
                        <button type="button" onClick={() => setConfirmId(p.id_producto)} style={s.btnDel} title="Eliminar"><Icon name ="trash" variant="dark" size={24}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PRECIOS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "precios" && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Código</th>
                <th style={s.th}>Producto</th>
                <th style={s.th}>Categoría</th>
                <th style={s.th}>Unidad</th>
                <th style={{ ...s.th, textAlign: "right" }}>P. Unitario</th>
                <th style={{ ...s.th, textAlign: "right" }}>P. Mayoreo</th>
                <th style={{ ...s.th, textAlign: "center" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", color: "var(--muted)", padding: "3rem" }}>No se encontraron productos.</td></tr>
              ) : (
                productosFiltrados.map((p) => {
                  const editingThis = precioEditando === p.id_producto;
                  return (
                    <tr key={p.id_producto} style={s.tr}>
                      <td style={s.td}><code style={s.code}>{p.codigo_producto}</code></td>
                      <td style={{ ...s.td, fontWeight: 500 }}>{p.nombre_producto}</td>
                      <td style={{ ...s.td, color: "var(--muted)" }}>{p.nombre_categoria}</td>
                      <td style={{ ...s.td, color: "var(--muted)" }}>{p.unidad_medida}</td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        {editingThis ? (
                          <input type="number" step="0.01" min="0" value={precioForm.precio_unitario} onChange={(e) => setPrecioForm(f => ({ ...f, precio_unitario: e.target.value }))} style={{ ...s.priceInput }} />
                        ) : (
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>Q{Number(p.precio_unitario ?? 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        {editingThis ? (
                          <input type="number" step="0.01" min="0" value={precioForm.precio_mayoreo} onChange={(e) => setPrecioForm(f => ({ ...f, precio_mayoreo: e.target.value }))} style={{ ...s.priceInput }} />
                        ) : (
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>Q{Number(p.precio_mayoreo ?? 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {editingThis ? (
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                            <button type="button" onClick={() => guardarPrecio(p.id_producto)} disabled={savingPrecio} style={{ ...s.btnSave }}>{savingPrecio ? "…" : "Guardar"}</button>
                            <button type="button" onClick={() => setPrecioEditando(null)} style={s.btnCancel}>Cancelar</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => iniciarEditarPrecio(p)} style={s.btnEdit}><Icon name ="pencil" variant="dark" size={22}/> Editar</button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Crear / Editar producto ── */}
      {modalOpen && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editando ? "Editar producto" : "Nuevo producto"}</h2>
              <button type="button" onClick={cerrarModal} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.fila}>
                <Field label="Código *" style={{ flex: "0 0 140px" }}>
                  <input style={s.input} value={form.codigo_producto} onChange={(e) => setForm(f => ({ ...f, codigo_producto: e.target.value }))} placeholder="ARR-001" autoFocus />
                </Field>
                <Field label="Nombre del producto *" style={{ flex: 1 }}>
                  <input style={s.input} value={form.nombre_producto} onChange={(e) => setForm(f => ({ ...f, nombre_producto: e.target.value }))} placeholder="Arroz 1 libra" />
                </Field>
              </div>
              <div style={s.fila}>
                <Field label="Categoría *" style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <select style={s.input} value={form.id_categoria} onChange={(e) => setForm(f => ({ ...f, id_categoria: e.target.value }))}>
                      <option value="">— Selecciona —</option>
                      {categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>)}
                    </select>
                    <button type="button" onClick={() => setCreandoCategoria(v => !v)} style={s.btnSecondary}>+ Nueva</button>
                  </div>
                  {creandoCategoria && (
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                      <input style={s.input} value={nuevaCategoriaNombre} onChange={(e) => setNuevaCategoriaNombre(e.target.value)} placeholder="Nombre de la categoría" />
                      <button type="button" onClick={guardarCategoriaNueva} disabled={guardandoCategoria} style={s.btnSave}>{guardandoCategoria ? "…" : "Guardar"}</button>
                    </div>
                  )}
                  {errorCategoria && <span style={{ fontSize: "0.78rem", color: "var(--red)" }}>{errorCategoria}</span>}
                </Field>
                <Field label="Marca *" style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <select style={s.input} value={form.id_marca} onChange={(e) => setForm(f => ({ ...f, id_marca: e.target.value }))}>
                      <option value="">— Selecciona —</option>
                      {marcas.map((m) => <option key={m.id_marca} value={m.id_marca}>{m.nombre_marca}</option>)}
                    </select>
                    <button type="button" onClick={() => setCreandoMarca(v => !v)} style={s.btnSecondary}>+ Nueva</button>
                  </div>
                  {creandoMarca && (
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                      <input style={s.input} value={nuevaMarcaNombre} onChange={(e) => setNuevaMarcaNombre(e.target.value)} placeholder="Nombre de la marca" />
                      <button type="button" onClick={guardarMarcaNueva} disabled={guardandoMarca} style={s.btnSave}>{guardandoMarca ? "…" : "Guardar"}</button>
                    </div>
                  )}
                  {errorMarca && <span style={{ fontSize: "0.78rem", color: "var(--red)" }}>{errorMarca}</span>}
                </Field>
              </div>
              <div style={s.fila}>
                <Field label="Precio unitario" style={{ flex: 1 }}>
                  <input style={s.input} type="number" step="0.01" min="0" value={form.precio_unitario} onChange={(e) => setForm(f => ({ ...f, precio_unitario: e.target.value }))} placeholder="0.00" />
                </Field>
                <Field label="Precio mayoreo" style={{ flex: 1 }}>
                  <input style={s.input} type="number" step="0.01" min="0" value={form.precio_mayoreo} onChange={(e) => setForm(f => ({ ...f, precio_mayoreo: e.target.value }))} placeholder="0.00" />
                </Field>
                <Field label="Unidad de medida *" style={{ flex: 1 }}>
                  <input style={s.input} value={form.unidad_medida} onChange={(e) => setForm(f => ({ ...f, unidad_medida: e.target.value }))} placeholder="libra, litro, unidad…" />
                  {liquidoRequiereCaja && <span style={{ fontSize: "0.75rem", color: "var(--red)" }}>Unidad líquida: necesita una presentación tipo caja (abajo).</span>}
                  {esLibra && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Se mide en libras: puedes ofrecerla como &quot;saco&quot; abajo.</span>}
                </Field>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <CheckField label="Producto con fecha de caducidad" checked={form.caducidad} onChange={(v) => setForm(f => ({ ...f, caducidad: v }))} />
                <CheckField label="Exento de IVA" checked={form.exento_iva} onChange={(v) => setForm(f => ({ ...f, exento_iva: v }))} />
                <CheckField label="Producto activo" checked={form.estado_producto} onChange={(v) => setForm(f => ({ ...f, estado_producto: v }))} />
              </div>
              {form.caducidad && (
                <Field label="Fecha de caducidad" style={{ maxWidth: 220 }}>
                  <input style={s.input} type="date" value={form.fecha_caducidad} onChange={(e) => setForm(f => ({ ...f, fecha_caducidad: e.target.value }))} />
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Referencia general del producto (no por lote).</span>
                </Field>
              )}

              {!editando && (
                <>
                  {/* ── Proveedores ── */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Proveedores</label>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                      <div style={{ position: "relative", flex: "1 1 240px" }}>
                        <input
                          style={s.input}
                          placeholder="Buscar proveedor por nombre o NIT…"
                          value={proveedorQuery}
                          onChange={(e) => { setProveedorQuery(e.target.value); setProveedorSugerenciasAbiertas(true); }}
                          onFocus={() => setProveedorSugerenciasAbiertas(true)}
                          onBlur={() => setTimeout(() => setProveedorSugerenciasAbiertas(false), 150)}
                        />
                        {proveedorSugerenciasAbiertas && proveedorQuery.trim() !== "" && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, marginTop: 2, zIndex: 20, maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 10px rgba(0,0,0,0.12)" }}>
                            {proveedoresFiltrados.length === 0 ? (
                              <div style={{ padding: "0.5rem 0.7rem", fontSize: "0.85rem", color: "var(--muted)" }}>Sin resultados — prueba &quot;+ Proveedor nuevo&quot;.</div>
                            ) : (
                              proveedoresFiltrados.slice(0, 8).map((p) => (
                                <div key={p.id_proveedor} onMouseDown={() => agregarProveedor(p)} style={{ padding: "0.45rem 0.7rem", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--border)" }}>
                                  {p.nombre_proveedor} <span style={{ color: "var(--muted)" }}>({p.nit_proveedor})</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setCreandoProveedor(v => !v)} style={s.btnSecondary}>+ Proveedor nuevo</button>
                    </div>
                    {proveedoresSeleccionados.length > 0 && (
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                        {proveedoresSeleccionados.map((p) => (
                          <span key={p.id_proveedor} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>
                            {p.nombre_proveedor}
                            <button type="button" onClick={() => quitarProveedor(p.id_proveedor)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {creandoProveedor && (
                      <div style={{ marginTop: "0.75rem", padding: "0.85rem", background: "var(--surface2)", borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                        <Field label="Nombre *"><input style={s.input} value={formProveedorNuevo.nombre_proveedor} onChange={(e) => setFormProveedorNuevo(f => ({ ...f, nombre_proveedor: e.target.value }))} /></Field>
                        <Field label="NIT *"><input style={s.input} value={formProveedorNuevo.nit_proveedor} onChange={(e) => setFormProveedorNuevo(f => ({ ...f, nit_proveedor: e.target.value }))} /></Field>
                        <Field label="Correo"><input style={s.input} value={formProveedorNuevo.correo_contacto} onChange={(e) => setFormProveedorNuevo(f => ({ ...f, correo_contacto: e.target.value }))} /></Field>
                        <Field label="Teléfono"><input style={s.input} value={formProveedorNuevo.telefono} onChange={(e) => setFormProveedorNuevo(f => ({ ...f, telefono: e.target.value }))} /></Field>
                        {errorProveedor && <div style={{ gridColumn: "1 / -1", color: "var(--red)", fontSize: "0.82rem" }}>{errorProveedor}</div>}
                        <div style={{ gridColumn: "1 / -1" }}>
                          <button type="button" onClick={guardarProveedorNuevo} disabled={guardandoProveedor} style={s.btnSave}>{guardandoProveedor ? "Guardando…" : "Guardar proveedor"}</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Presentaciones por mayor ── */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      Presentaciones por mayor {liquidoRequiereCaja ? "(obligatoria para líquidos)" : "(opcional)"}
                    </label>
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.3rem 0 0.6rem" }}>Ej. &quot;Caja de 24&quot; = 24 unidades base, &quot;Saco de 50&quot; = 50 libras base.</p>
                    {presentacionesForm.map((p, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                        <input style={{ ...s.input, flex: "1 1 200px" }} value={p.nombre_presentacion} onChange={(e) => actualizarPresentacion(idx, "nombre_presentacion", e.target.value)} placeholder="Ej: Caja de 24" />
                        <input style={{ ...s.input, width: 170 }} type="number" min="0" step="1" value={p.factor_conversion} onChange={(e) => actualizarPresentacion(idx, "factor_conversion", e.target.value)} placeholder="Cantidad de unidades base" />
                        <button type="button" onClick={() => quitarPresentacionFila(idx)} style={s.btnDel} title="Quitar"><Icon name="trash" size={14} /></button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => agregarFilaPresentacion()} style={s.btnSecondary}>+ Agregar presentación</button>
                      {liquidoRequiereCaja && <button type="button" onClick={() => agregarFilaPresentacion("Caja")} style={s.btnSecondary}>+ Agregar caja</button>}
                      {esLibra && <button type="button" onClick={() => agregarFilaPresentacion("Saco")} style={s.btnSecondary}>+ Agregar saco</button>}
                    </div>
                  </div>
                </>
              )}
              {formError && <p style={s.formError}>{formError}</p>}
            </div>
            <div style={s.modalFooter}>
              <button type="button" onClick={cerrarModal} style={s.btnSecondary} disabled={saving}>Cancelar</button>
              <button type="button" onClick={handleGuardar} style={s.btnPrimary} disabled={saving}>{saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear producto"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmId !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 400 }}>
            <div style={s.modalHeader}><h2 style={s.modalTitle}>¿Eliminar producto?</h2></div>
            <div style={s.modalBody}>
              <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>Si el producto tiene historial, será <strong style={{ color: "var(--text)" }}>desactivado</strong> en lugar de eliminado para conservar el registro.</p>
            </div>
            <div style={s.modalFooter}>
              <button type="button" onClick={() => setConfirmId(null)} style={s.btnSecondary} disabled={deleting}>Cancelar</button>
              <button type="button" onClick={() => handleEliminar(confirmId)} style={{ ...s.btnPrimary, background: "var(--red)" }} disabled={deleting}>{deleting ? "Eliminando…" : "Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...s.toast, background: toast.tipo === "ok" ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)", borderColor: toast.tipo === "ok" ? "rgba(63,185,80,.4)" : "rgba(248,81,73,.4)", color: toast.tipo === "ok" ? "var(--green)" : "var(--red)" }}>
          {toast.msg}
        </div>
      )}
    </StaffShell>
  );
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", ...style }}>
      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "var(--text)", fontSize: "0.88rem" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
      {label}
    </label>
  );
}

const s: Record<string, CSSProperties> = {
  tabRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" },
  tabBtn: { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", borderRadius: 999, padding: "0.45rem 0.85rem", cursor: "pointer", fontSize: "0.85rem" },
  toolbar: { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" },
  searchInput: { flex: 1, minWidth: 220, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.6rem 1rem", color: "var(--text)", fontSize: "0.88rem", outline: "none" },
  checkLabel: { display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", userSelect: "none" } as CSSProperties,
  btnPrimary: { background: "var(--accent)", color: "#eff5ff", border: "none", borderRadius: "var(--radius)", padding: "0.6rem 1.2rem", fontFamily: "var(--font-head)", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" } as CSSProperties,
  btnSecondary: { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.6rem 1.2rem", fontSize: "0.88rem", cursor: "pointer" },
  tableWrapper: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "var(--surface2)", color: "var(--muted)", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.75rem 1rem", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" } as CSSProperties,
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "0.75rem 1rem", color: "var(--text)", fontSize: "0.88rem", verticalAlign: "middle" },
  code: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.1rem 0.4rem", fontSize: "0.75rem", color: "var(--accent)", fontFamily: "monospace" },
  badge: { fontSize: "0.65rem", padding: "0.05rem 0.4rem", borderRadius: 99, background: "rgba(232,160,69,.12)", color: "var(--accent)", border: "1px solid rgba(232,160,69,.25)", fontWeight: 600 } as CSSProperties,
  statusBadge: { display: "inline-block", fontSize: "0.72rem", padding: "0.15rem 0.6rem", borderRadius: 99, border: "1px solid", fontWeight: 600, letterSpacing: "0.04em" } as CSSProperties,
  btnEdit: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.85rem" },
  btnDel: { background: "rgba(248,81,73,.1)", border: "1px solid rgba(248,81,73,.25)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.85rem" },
  btnSave: { background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 6, padding: "0.3rem 0.75rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" },
  btnCancel: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.75rem", fontSize: "0.82rem", cursor: "pointer", color: "var(--muted)" },
  priceInput: { width: 90, padding: "0.3rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.88rem", outline: "none", textAlign: "right" } as CSSProperties,
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem" } as CSSProperties,
  modal: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "90vh", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" },
  modalTitle: { fontFamily: "var(--font-head)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: 0 },
  closeBtn: { background: "transparent", border: "none", color: "var(--muted)", fontSize: "1rem", cursor: "pointer", padding: "0.2rem 0.4rem" },
  modalBody: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto", flex: 1 } as CSSProperties,
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" },
  fila: { display: "flex", gap: "1rem", flexWrap: "wrap" },
  input: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.85rem", color: "var(--text)", fontSize: "0.9rem", outline: "none", width: "100%" },
  formError: { color: "var(--red)", fontSize: "0.85rem", margin: "0.25rem 0 0" },
  toast: { position: "fixed", bottom: "2rem", right: "2rem", padding: "0.85rem 1.25rem", borderRadius: "var(--radius)", border: "1px solid", fontSize: "0.88rem", fontWeight: 500, zIndex: 300, backdropFilter: "blur(8px)", boxShadow: "var(--shadow)" } as CSSProperties,
};