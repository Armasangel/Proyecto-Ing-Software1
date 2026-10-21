import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { matchesQuery, paginar, PaginationBar, type PageSize } from "@/lib/ui-table";
import { PresentacionesProducto } from "@/components/inventario-catalogo/PresentacionesProducto";
import { normalizarUnidad, presentacionesIniciales, validarPresentaciones, type Presentacion } from "@/lib/presentaciones";
import { validarCategoriasProducto } from "@/lib/producto-categorias";
import { CategoriaAutocompletar } from "@/components/inventario-catalogo/CategoriaAutocompletar";
import { MarcaAutocompletar } from "@/components/inventario-catalogo/MarcaAutocompletar";

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
  id_categoria_2?: number | null;
  id_categoria_3?: number | null;
  nombre_categoria_2?: string | null;
  nombre_categoria_3?: string | null;
  nombre_marca: string;
  id_marca: number;
  precio_unitario: string | null;
  precio_mayoreo: string | null;
  unidad_medida: string;
  estado_producto: boolean;
  caducidad: boolean;
  fecha_caducidad?: string | null;
  exento_iva: boolean;
}

interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}
interface Marca {
  id_marca: number;
  nombre_marca: string;
  usos?: number;
}
interface Proveedor {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string | null;
  telefono: string | null;
}
const PROVEEDOR_VACIO = { nombre_proveedor: "", nit_proveedor: "", correo_contacto: "", telefono: "" };

const EMPTY_FORM = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  id_categoria: "",
  id_categoria_2: "",
  id_categoria_3: "",
  id_marca: "",
  caducidad: false,
  fecha_caducidad: "",
  exento_iva: false,
  estado_producto: true,
};

export type CatalogoTab = "productos" | "precios";

export function CatalogoView({ tab }: { tab: CatalogoTab }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  // Filtros (panel lateral desplegable) y paginación
  const [panelFiltros, setPanelFiltros] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroExentoIva, setFiltroExentoIva] = useState(false);
  const [filtroCaducidad, setFiltroCaducidad] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

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
  const [categoriaDestino, setCategoriaDestino] = useState<"id_categoria" | "id_categoria_2" | "id_categoria_3">("id_categoria");
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState("");
  const [creandoMarca, setCreandoMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState("");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [errorMarca, setErrorMarca] = useState("");

  // Presentaciones por mayor (ej. "Caja de 24", "Saco de 50 libras")
  const [presentacionesForm, setPresentacionesForm] = useState<Presentacion[]>([]);
  const [presentacionesOriginales, setPresentacionesOriginales] = useState<Presentacion[]>([]);
  const [presentacionesCargando, setPresentacionesCargando] = useState(false);
  const [presentacionesError, setPresentacionesError] = useState("");
  const [reintentoPresentaciones, setReintentoPresentaciones] = useState(0);
  const unidadBase = normalizarUnidad(form.unidad_medida);
  const cambiaUnidad = !!editando && unidadBase !== normalizarUnidad(editando.unidad_medida);

  useEffect(() => {
    if (!modalOpen) return;
    setPresentacionesForm(editando && unidadBase === normalizarUnidad(editando.unidad_medida)
      ? presentacionesOriginales
      : presentacionesIniciales(unidadBase));
  }, [modalOpen, editando, unidadBase, presentacionesOriginales]);

  useEffect(() => {
    if (!modalOpen || !editando) return;
    const controller = new AbortController();
    setPresentacionesCargando(true);
    setPresentacionesError("");
    fetch(`/api/presentaciones?id_producto=${editando.id_producto}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) setPresentacionesOriginales((data.presentaciones || []).map((p: Presentacion) => ({ ...p, factor_conversion: Number(p.factor_conversion) })));
      })
      .catch(() => { if (!controller.signal.aborted) setPresentacionesError("No se pudieron cargar las presentaciones del producto."); })
      .finally(() => { if (!controller.signal.aborted) setPresentacionesCargando(false); });
    return () => controller.abort();
  }, [modalOpen, editando, reintentoPresentaciones]);

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
    fetch("/api/marcas").then((r) => r.json()).then((d) => setMarcas(d.marcas || []));
  }, []);

  useEffect(() => {
    cargarProductos();
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.categorias || []));
    fetch("/api/proveedores")
      .then((r) => (r.ok ? r.json() : { proveedores: [] }))
      .then((d) => setProveedores(d.proveedores || []))
      .catch(() => setProveedores([]));
  }, [cargarProductos]);

  // Al cambiar búsqueda o filtros, se vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [busqueda, soloActivos, filtroCategoria, filtroMarca, filtroExentoIva, filtroCaducidad, perPage]);

  const proveedoresFiltrados = proveedores.filter(
    (p) =>
      !proveedoresSeleccionados.some((s) => s.id_proveedor === p.id_proveedor) &&
      matchesQuery(proveedorQuery, p.nombre_proveedor, p.nit_proveedor)
  );

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const resetExtras = () => {
    setProveedoresSeleccionados([]);
    setProveedorQuery("");
    setCreandoProveedor(false);
    setFormProveedorNuevo(PROVEEDOR_VACIO);
    setErrorProveedor("");
    setPresentacionesForm([]);
    setPresentacionesOriginales([]);
    setPresentacionesCargando(false);
    setPresentacionesError("");
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
      id_categoria_2: p.id_categoria_2 == null ? "" : String(p.id_categoria_2),
      id_categoria_3: p.id_categoria_3 == null ? "" : String(p.id_categoria_3),
      id_marca: String(p.id_marca),
      caducidad: p.caducidad,
      fecha_caducidad: p.fecha_caducidad?.slice(0, 10) ?? "",
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
        setForm((f) => ({ ...f, [categoriaDestino]: String(data.categoria.id_categoria) }));
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

  const handleGuardar = async () => {
    if (guardandoCategoria || guardandoMarca) return;
    if (!form.codigo_producto || !form.nombre_producto || !form.unidad_medida || !form.id_categoria || !form.id_marca) {
      setFormError("Completa todos los campos obligatorios (*)");
      return;
    }
    if (presentacionesCargando || presentacionesError) return;
    const errorCategorias = validarCategoriasProducto([Number(form.id_categoria), form.id_categoria_2 ? Number(form.id_categoria_2) : null, form.id_categoria_3 ? Number(form.id_categoria_3) : null]);
    if (errorCategorias) { setFormError(errorCategorias); return; }
    const errorPresentaciones = validarPresentaciones(presentacionesForm);
    if (errorPresentaciones) { setFormError(errorPresentaciones); return; }
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
      id_categoria_2: form.id_categoria_2 ? Number(form.id_categoria_2) : null,
      id_categoria_3: form.id_categoria_3 ? Number(form.id_categoria_3) : null,
      id_marca: Number(form.id_marca),
    };
    if (!editando) {
      payload.id_proveedores = proveedoresSeleccionados.map((p) => p.id_proveedor);
    }
    payload.presentaciones = presentacionesForm;
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
  const filtrosActivos =
    (filtroCategoria ? 1 : 0) +
    (filtroMarca ? 1 : 0) +
    (filtroExentoIva ? 1 : 0) +
    (filtroCaducidad ? 1 : 0) +
    (soloActivos ? 0 : 1);

  const limpiarFiltros = () => {
    setBusqueda("");
    setSoloActivos(true);
    setFiltroCategoria("");
    setFiltroMarca("");
    setFiltroExentoIva(false);
    setFiltroCaducidad(false);
  };

  const productosFiltrados = useMemo(
    () =>
      productos.filter((p) => {
        if (soloActivos && !p.estado_producto) return false;
        if (filtroCategoria && ![p.id_categoria, p.id_categoria_2, p.id_categoria_3].some((id) => String(id) === filtroCategoria)) return false;
        if (filtroMarca && String(p.id_marca) !== filtroMarca) return false;
        if (filtroExentoIva && !p.exento_iva) return false;
        if (filtroCaducidad && !p.caducidad) return false;
        return matchesQuery(busqueda, p.nombre_producto, p.codigo_producto, p.nombre_categoria, p.nombre_categoria_2, p.nombre_categoria_3, p.nombre_marca);
      }),
    [productos, busqueda, soloActivos, filtroCategoria, filtroMarca, filtroExentoIva, filtroCaducidad]
  );

  const productosPage = useMemo(
    () => paginar(productosFiltrados, page, perPage),
    [productosFiltrados, page, perPage]
  );

  return (
    <>
      {/* ── Barra de búsqueda + acciones ── */}
      <div style={s.toolbar}>
        <input
          type="text"
          placeholder="Buscar producto, código, categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={s.searchInput}
        />
        <button
          type="button"
          onClick={() => setPanelFiltros((v) => !v)}
          aria-expanded={panelFiltros}
          style={{
            ...s.btnSecondary,
            borderColor: panelFiltros ? "rgba(45,106,79,.55)" : "var(--border)",
            color: panelFiltros ? "var(--text)" : "var(--muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          Filtros
          {filtrosActivos > 0 && <span style={s.filtroBadge}>{filtrosActivos}</span>}
        </button>
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
              {productosPage.slice.length === 0 ? (
                <tr><td colSpan={9} style={{ ...s.td, textAlign: "center", color: "var(--muted)", padding: "3rem" }}>No se encontraron productos.</td></tr>
              ) : (
                productosPage.slice.map((p) => (
                  <tr key={p.id_producto} style={{ ...s.tr, opacity: p.estado_producto ? 1 : 0.5 }}>
                    <td style={s.td}><code style={s.code}>{p.codigo_producto}</code></td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 500 }}>{p.nombre_producto}</span>
                      <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                        {p.caducidad && <span style={s.badge}>Caduca</span>}
                        {p.exento_iva && <span style={{ ...s.badge, background: "rgba(88,166,255,.15)", color: "var(--blue)", borderColor: "rgba(88,166,255,.3)" }}>Exento IVA</span>}
                      </div>
                    </td>
                    <td style={s.td}>{[p.nombre_categoria, p.nombre_categoria_2, p.nombre_categoria_3].filter(Boolean).join(" · ")}</td>
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
          <PaginationBar
            total={productosPage.total}
            page={productosPage.paginaSegura}
            perPage={perPage}
            onPage={setPage}
            onPerPage={setPerPage}
            noun="productos"
          />
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
              {productosPage.slice.length === 0 ? (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", color: "var(--muted)", padding: "3rem" }}>No se encontraron productos.</td></tr>
              ) : (
                productosPage.slice.map((p) => {
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
          <PaginationBar
            total={productosPage.total}
            page={productosPage.paginaSegura}
            perPage={perPage}
            onPage={setPage}
            onPerPage={setPerPage}
            noun="productos"
          />
        </div>
      )}

      {/* ── Panel lateral de filtros (desplegable) ── */}
      {panelFiltros && (
        <>
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => setPanelFiltros(false)}
            style={s.drawerBackdrop}
          />
          <aside style={s.drawer}>
            <div style={s.drawerHeader}>
              <h2 style={s.drawerTitle}>Filtros</h2>
              <button type="button" onClick={() => setPanelFiltros(false)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.drawerBody}>
              <label style={s.drawerLabel}>Categoría</label>
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={s.input} aria-label="Filtrar por categoría">
                <option value="">Todas las categorías</option>
                {categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>)}
              </select>

              <label style={s.drawerLabel}>Marca</label>
              <MarcaAutocompletar marcas={marcas} value={filtroMarca} onChange={setFiltroMarca} style={s.input}
                ariaLabel="Filtrar por marca" opcional textoSinSeleccion="Todas las marcas" />

              <label style={s.drawerLabel}>Estado</label>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={!soloActivos} onChange={(e) => setSoloActivos(!e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                Ver inactivos
              </label>

              <label style={s.drawerLabel}>Atributos</label>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={filtroExentoIva} onChange={(e) => setFiltroExentoIva(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                Solo exentos de IVA
              </label>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={filtroCaducidad} onChange={(e) => setFiltroCaducidad(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                Solo con caducidad
              </label>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                <button type="button" onClick={limpiarFiltros} style={{ ...s.btnSecondary, width: "100%" }}>Limpiar filtros</button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ── Modal Crear / Editar producto ── */}
      {modalOpen && (
        <div
          style={{
            ...s.overlay,
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)", // Oscurece el fondo
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 101,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div
            style={{
              ...s.modal,
              backgroundColor: "var(--surface)", // Fondo blanco sólido
              color: "var(--text)",           // Texto legible y oscuro
              borderRadius: "12px",
              width: "90%",
              maxWidth: "600px",
              maxHeight: "90vh",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ ...s.modalHeader, padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ ...s.modalTitle, margin: 0, color: "var(--text)" }}>
                {editando ? "Editar producto" : "Nuevo producto"}
              </h2>
              <button 
                type="button" 
                onClick={cerrarModal} 
                style={{ ...s.closeBtn, color: "var(--text)", background: "transparent", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ ...s.modalBody, padding: "0 1.5rem 1.5rem", overflowY: "auto" }}>
              <div style={s.fila}>
                <Field label="Código *" style={{ flex: "0 0 140px" }}>
                  <input 
                    style={{ ...s.input, backgroundColor: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} 
                    value={form.codigo_producto} 
                    onChange={(e) => setForm(f => ({ ...f, codigo_producto: e.target.value }))} 
                    placeholder="ARR-001" 
                    autoFocus 
                  />
                </Field>
                <Field label="Nombre del producto *" style={{ flex: 1 }}>
                  <input 
                    style={{ ...s.input, backgroundColor: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} 
                    value={form.nombre_producto} 
                    onChange={(e) => setForm(f => ({ ...f, nombre_producto: e.target.value }))} 
                    placeholder="Arroz 1 libra" 
                  />
                </Field>
              </div>
              <div style={s.fila}>
                {([
                  { key: "id_categoria", label: "Categoría principal *", numero: 1 },
                  { key: "id_categoria_2", label: "Categoría 2 (opcional)", numero: 2 },
                  { key: "id_categoria_3", label: "Categoría 3 (opcional)", numero: 3 },
                ] as const).map(({ key, label, numero }) => (
                  <Field key={key} label={label} style={{ flex: "1 1 170px" }}>
                    <CategoriaAutocompletar
                      ariaLabel={label} style={s.input} value={form[key]} disabled={saving || guardandoCategoria}
                      opcional={numero !== 1}
                      categorias={categorias.filter((c) => !["id_categoria", "id_categoria_2", "id_categoria_3"].some((otra) => otra !== key && form[otra as typeof key] === String(c.id_categoria)))}
                      onChange={(id) => setForm((f) => ({ ...f, [key]: id }))}
                    />
                    <button type="button" style={s.btnSecondary} disabled={saving || guardandoCategoria}
                      onClick={() => { setCategoriaDestino(key); setCreandoCategoria(true); setNuevaCategoriaNombre(""); setErrorCategoria(""); }}>
                      + Crear categoría {numero}
                    </button>
                  </Field>
                ))}
              </div>
              {creandoCategoria && (
                <div style={{ padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <Field label={"Nueva categoría para " + (categoriaDestino === "id_categoria" ? "categoría principal" : categoriaDestino === "id_categoria_2" ? "categoría 2" : "categoría 3")}>
                    <input aria-label="Nombre de nueva categoría" style={s.input} maxLength={100} value={nuevaCategoriaNombre}
                      onChange={(e) => setNuevaCategoriaNombre(e.target.value)} disabled={guardandoCategoria}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!guardandoCategoria) guardarCategoriaNueva(); } }} />
                  </Field>
                  {errorCategoria && <p role="alert" style={s.formError}>{errorCategoria}</p>}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button type="button" onClick={guardarCategoriaNueva} disabled={guardandoCategoria} style={s.btnSave}>{guardandoCategoria ? "Creando…" : "Crear categoría"}</button>
                    <button type="button" onClick={() => setCreandoCategoria(false)} disabled={guardandoCategoria} style={s.btnSecondary}>Cancelar categoría</button>
                  </div>
                </div>
              )}
              <div style={s.fila}>
                <Field label="Marca *" style={{ flex: 1 }}>
                  <MarcaAutocompletar marcas={marcas} style={s.input} value={form.id_marca} disabled={saving || guardandoMarca}
                    onChange={(id) => setForm((f) => ({ ...f, id_marca: id }))} />
                  <button type="button" onClick={() => { setCreandoMarca(true); setNuevaMarcaNombre(""); setErrorMarca(""); }} disabled={saving || guardandoMarca} style={s.btnSecondary}>+ Crear marca</button>
                </Field>
              </div>
              {creandoMarca && (
                <div style={{ padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <Field label="Nueva marca">
                    <input aria-label="Nombre de nueva marca" style={s.input} maxLength={100} value={nuevaMarcaNombre}
                      onChange={(e) => setNuevaMarcaNombre(e.target.value)} disabled={guardandoMarca}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!guardandoMarca) guardarMarcaNueva(); } }} />
                  </Field>
                  {errorMarca && <p role="alert" style={s.formError}>{errorMarca}</p>}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button type="button" onClick={guardarMarcaNueva} disabled={guardandoMarca} style={s.btnSave}>{guardandoMarca ? "Creando…" : "Crear marca"}</button>
                    <button type="button" onClick={() => setCreandoMarca(false)} disabled={guardandoMarca} style={s.btnSecondary}>Cancelar marca</button>
                  </div>
                </div>
              )}
              <div style={s.fila}>
                <Field label="Precio unitario" style={{ flex: 1 }}>
                  <input 
                    style={{ ...s.input, backgroundColor: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={form.precio_unitario} 
                    onChange={(e) => setForm(f => ({ ...f, precio_unitario: e.target.value }))} 
                    placeholder="0.00" 
                  />
                </Field>
                <Field label="Precio mayoreo" style={{ flex: 1 }}>
                  <input 
                    style={{ ...s.input, backgroundColor: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={form.precio_mayoreo} 
                    onChange={(e) => setForm(f => ({ ...f, precio_mayoreo: e.target.value }))} 
                    placeholder="0.00" 
                  />
                </Field>
                <Field label="Unidad de medida *" style={{ flex: 1 }}>
                  <input 
                    aria-label="Unidad de medida"
                    disabled={saving || presentacionesCargando || !!presentacionesError}
                    style={{ ...s.input, backgroundColor: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} 
                    value={form.unidad_medida} 
                    onChange={(e) => setForm(f => ({ ...f, unidad_medida: e.target.value }))} 
                    placeholder="libra, botella, unidad…"
                  />
                </Field>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
                Los líquidos se venden por botella. Registra cada tamaño (800 ml, 1 L, etc.) como un producto distinto; las cajas agrupan botellas del mismo producto.
              </p>
              {cambiaUnidad && (
                <p role="status" style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
                  Al guardar se corregirá la unidad de {editando.unidad_medida} a {form.unidad_medida || "la nueva unidad"}.
                  Las cantidades y los precios actuales se conservan: por ejemplo, 10 {editando.unidad_medida} pasarán a ser 10 {form.unidad_medida || "unidades"}.
                  Selecciona las presentaciones de la nueva unidad. Las anteriores quedarán inactivas y conservarán sus referencias históricas.
                </p>
              )}
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.25rem", color: "var(--text)" }}>
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

                </>
              )}
              {presentacionesCargando && <p role="status">Cargando presentaciones…</p>}
              {presentacionesError && (
                <div role="alert" style={s.formError}>
                  {presentacionesError}
                  <button type="button" onClick={() => setReintentoPresentaciones((v) => v + 1)} style={s.btnSecondary}>Reintentar carga</button>
                </div>
              )}
              <PresentacionesProducto
                key={editando?.id_producto ?? "nuevo"}
                unidad={form.unidad_medida}
                value={presentacionesForm}
                onChange={setPresentacionesForm}
                disabled={saving || presentacionesCargando || !!presentacionesError}
              />
              {formError && <p style={s.formError}>{formError}</p>}
            </div>
            <div style={{ ...s.modalFooter, padding: "1rem 1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={cerrarModal} style={s.btnSecondary} disabled={saving}>Cancelar</button>
              <button type="button" onClick={handleGuardar} style={s.btnSecondary} disabled={saving || guardandoCategoria || guardandoMarca || presentacionesCargando || !!presentacionesError}>{saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear producto"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmId !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 400, background: "var(--accent)", color: "#fff"}}>
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
    </>
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
  filtroBadge: { background: "var(--accent)", color: "#0d1117", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 0.35rem" } as CSSProperties,
  drawerBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 150, border: "none", cursor: "pointer" } as CSSProperties,
  drawer: { position: "fixed", top: 0, right: 0, height: "100vh", width: "min(360px, 100vw)", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 32px rgba(0,0,0,.35)", zIndex: 160, display: "flex", flexDirection: "column", fontFamily: "var(--font-body)" } as CSSProperties,
  drawerHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", flexShrink: 0 },
  drawerTitle: { margin: 0, fontFamily: "var(--font-head)", fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" },
  drawerBody: { padding: "1.25rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.65rem" } as CSSProperties,
  drawerLabel: { fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginTop: "0.5rem" },
  toast: { position: "fixed", bottom: "2rem", right: "2rem", padding: "0.85rem 1.25rem", borderRadius: "var(--radius)", border: "1px solid", fontSize: "0.88rem", fontWeight: 500, zIndex: 300, backdropFilter: "blur(8px)", boxShadow: "var(--shadow)" } as CSSProperties,
};
