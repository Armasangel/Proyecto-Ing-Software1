"use client";

import { useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo } from "@/lib/roles";
import { Icon } from "@/components/Icon";

type Fila = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  estado_producto: boolean;
  caducidad: boolean;
  fecha_caducidad: string | null;
  nombre_categoria: string;
  nombre_marca: string;
};

type Categoria = { id_categoria: number; nombre_categoria: string };
type Marca = { id_marca: number; nombre_marca: string };
type Proveedor = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string | null;
  telefono: string | null;
  estado_proveedor: boolean;
};
type PresentacionForm = { nombre_presentacion: string; factor_conversion: string };

/* Acento por rol — coherente con StaffShell */
const THEMES = {
  dueno: { head: "bg-mango-600", headText: "text-mango-600" },
  colaborador: { head: "bg-market-600", headText: "text-market-600" },
} as const;

const formInicial = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  estado_producto: true,
  caducidad: false,
  fecha_caducidad: "",
  exento_iva: false,
  id_categoria: "",
  id_marca: "",
};

const PROVEEDOR_VACIO = { nombre_proveedor: "", nit_proveedor: "", correo_contacto: "", telefono: "" };

// Mismos heurísticos que valida el backend en /api/productos: por nombre de
// unidad de medida detectamos si es un líquido embotellado (requiere caja
// obligatoria) o si se mide en libras (puede ofrecerse como "saco").
const UNIDADES_LIQUIDAS = ["botella", "litro", "lt", "ml", "galon", "galón"];
function esUnidadLiquida(unidad: string): boolean {
  const u = unidad.trim().toLowerCase();
  return UNIDADES_LIQUIDAS.some((k) => u.includes(k));
}
function esUnidadLibra(unidad: string): boolean {
  return unidad.trim().toLowerCase().includes("libra");
}

function matchesQuery(query: string, ...campos: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return campos.some((c) => c != null && String(c).toLowerCase().includes(q));
}

export default function ProductosPage() {
  const usuario = useStaffSession();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(formInicial);
  const [guardando, setGuardando] = useState(false);
  const [mensajeForm, setMensajeForm] = useState("");

  // Proveedores: buscador + selección múltiple + alta rápida (mismo patrón
  // que "+ Cliente nuevo" en Deudas).
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorQuery, setProveedorQuery] = useState("");
  const [proveedorSugerenciasAbiertas, setProveedorSugerenciasAbiertas] = useState(false);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<Proveedor[]>([]);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [formProveedorNuevo, setFormProveedorNuevo] = useState(PROVEEDOR_VACIO);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [errorProveedor, setErrorProveedor] = useState("");

  // Categorías y marcas: alta rápida igual que proveedores (mismo patrón
  // usado en Deudas para "+ Cliente nuevo").
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState("");

  const [creandoMarca, setCreandoMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState("");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [errorMarca, setErrorMarca] = useState("");

  // Presentaciones por mayor (ej. "Caja de 24", "Saco de 50 libras"),
  // capturadas junto con el producto en vez de tener que ir a otra pantalla.
  const [presentacionesForm, setPresentacionesForm] = useState<PresentacionForm[]>([]);

  const cargarProductos = () => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setFilas(d.productos || []);
      })
      .catch(() => setError("No se pudo cargar el catálogo interno"));
  };

  useEffect(() => {
    if (!usuario) return;
    cargarProductos();
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias || []));
    fetch("/api/marcas")
      .then((r) => r.json())
      .then((d) => setMarcas(d.marcas || []));
    // Solo el dueño tiene permiso sobre /api/proveedores; si un colaborador
    // entra aquí simplemente no verá sugerencias de proveedor (no es un error).
    fetch("/api/proveedores")
      .then((r) => (r.ok ? r.json() : { proveedores: [] }))
      .then((d) => setProveedores(d.proveedores || []))
      .catch(() => setProveedores([]));
  }, [usuario]);

  const proveedoresFiltrados = useMemo(
    () =>
      proveedores.filter(
        (p) =>
          !proveedoresSeleccionados.some((s) => s.id_proveedor === p.id_proveedor) &&
          matchesQuery(proveedorQuery, p.nombre_proveedor, p.nit_proveedor)
      ),
    [proveedores, proveedorQuery, proveedoresSeleccionados]
  );

  const liquidoRequiereCaja = esUnidadLiquida(form.unidad_medida);
  const esLibra = esUnidadLibra(form.unidad_medida);
  const presentacionesValidas = presentacionesForm.filter(
    (p) => p.nombre_presentacion.trim() && Number(p.factor_conversion) > 0
  );
  const faltaCajaObligatoria = liquidoRequiereCaja && presentacionesValidas.length === 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  };

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
      if (!res.ok) {
        setErrorProveedor(data.error || "Error al crear el proveedor");
      } else {
        setProveedores((prev) => [...prev, data.proveedor]);
        agregarProveedor(data.proveedor);
        setFormProveedorNuevo(PROVEEDOR_VACIO);
        setCreandoProveedor(false);
      }
    } catch {
      setErrorProveedor("Error de conexión");
    } finally {
      setGuardandoProveedor(false);
    }
  };

  const guardarCategoriaNueva = async () => {
    setErrorCategoria("");
    if (!nuevaCategoriaNombre.trim()) {
      setErrorCategoria("El nombre es obligatorio");
      return;
    }
    setGuardandoCategoria(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_categoria: nuevaCategoriaNombre.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCategoria(data.error || "Error al crear la categoría");
      } else {
        setCategorias((prev) => [...prev, data.categoria].sort((a, b) => a.nombre_categoria.localeCompare(b.nombre_categoria)));
        setForm((f) => ({ ...f, id_categoria: String(data.categoria.id_categoria) }));
        setNuevaCategoriaNombre("");
        setCreandoCategoria(false);
      }
    } catch {
      setErrorCategoria("Error de conexión");
    } finally {
      setGuardandoCategoria(false);
    }
  };

  const guardarMarcaNueva = async () => {
    setErrorMarca("");
    if (!nuevaMarcaNombre.trim()) {
      setErrorMarca("El nombre es obligatorio");
      return;
    }
    setGuardandoMarca(true);
    try {
      const res = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_marca: nuevaMarcaNombre.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMarca(data.error || "Error al crear la marca");
      } else {
        setMarcas((prev) => [...prev, data.marca].sort((a, b) => a.nombre_marca.localeCompare(b.nombre_marca)));
        setForm((f) => ({ ...f, id_marca: String(data.marca.id_marca) }));
        setNuevaMarcaNombre("");
        setCreandoMarca(false);
      }
    } catch {
      setErrorMarca("Error de conexión");
    } finally {
      setGuardandoMarca(false);
    }
  };

  const agregarFilaPresentacion = (nombrePreset = "") => {
    setPresentacionesForm((prev) => [...prev, { nombre_presentacion: nombrePreset, factor_conversion: "" }]);
  };

  const actualizarPresentacion = (idx: number, campo: keyof PresentacionForm, valor: string) => {
    setPresentacionesForm((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  };

  const quitarPresentacion = (idx: number) => {
    setPresentacionesForm((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetFormCompleto = () => {
    setForm(formInicial);
    setProveedoresSeleccionados([]);
    setPresentacionesForm([]);
    setProveedorQuery("");
    setCreandoProveedor(false);
    setFormProveedorNuevo(PROVEEDOR_VACIO);
    setCreandoCategoria(false);
    setNuevaCategoriaNombre("");
    setErrorCategoria("");
    setCreandoMarca(false);
    setNuevaMarcaNombre("");
    setErrorMarca("");
  };

  const handleSubmit = async () => {
    setMensajeForm("");
    if (faltaCajaObligatoria) {
      setMensajeForm(
        "Los productos con unidad líquida (botella, litro, ml, galón) necesitan al menos una presentación tipo caja. Agrégala abajo en \"Presentaciones por mayor\"."
      );
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
          precio_mayoreo: form.precio_mayoreo ? Number(form.precio_mayoreo) : null,
          fecha_caducidad: form.caducidad && form.fecha_caducidad ? form.fecha_caducidad : null,
          id_categoria: Number(form.id_categoria),
          id_marca: Number(form.id_marca),
          id_proveedores: proveedoresSeleccionados.map((p) => p.id_proveedor),
          presentaciones: presentacionesValidas.map((p) => ({
            nombre_presentacion: p.nombre_presentacion.trim(),
            factor_conversion: Number(p.factor_conversion),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensajeForm(data.error || "Error al guardar");
      } else {
        setMensajeForm("✓ Producto agregado correctamente");
        resetFormCompleto();
        cargarProductos();
        setTimeout(() => {
          setMostrarForm(false);
          setMensajeForm("");
        }, 1500);
      }
    } catch {
      setMensajeForm("Error de conexión");
    } finally {
      setGuardando(false);
    }
  };

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  const th = THEMES[staffVariantFromTipo(usuario.tipo_usuario)];
  const exito = mensajeForm.startsWith("✓");

  return (
    <StaffShell
      usuario={usuario}
      title="Productos"
      subtitle="Catálogo maestro (precios, categoría y estado)"
    >
      {error && <p className="text-achiote mb-4">{error}</p>}

      <div className="mb-5">
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setMensajeForm(""); }}
          className={`${th.head} text-white border-none rounded-control px-5 py-2.5 text-sm font-semibold transition-transform duration-100 active:scale-[0.97] hover:brightness-110`}
        >
          {mostrarForm ? "✕ Cancelar" : "+ Agregar producto"}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-[var(--border)] rounded-card shadow-warm p-6 mb-6 max-w-[700px]">
          <h3 className="mb-4 text-base font-semibold text-ink">Nuevo producto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Código *</label>
              <input name="codigo_producto" value={form.codigo_producto} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40" placeholder="Ej: PROD-001" />
            </div>
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Nombre *</label>
              <input name="nombre_producto" value={form.nombre_producto} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40" placeholder="Nombre del producto" />
            </div>
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Precio unitario</label>
              <input name="precio_unitario" type="number" value={form.precio_unitario} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Precio mayoreo</label>
              <input name="precio_mayoreo" type="number" value={form.precio_mayoreo} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Unidad de medida *</label>
              <input name="unidad_medida" value={form.unidad_medida} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40" placeholder="Ej: unidad, caja, kg" />
            </div>
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Categoría *</label>
              <select name="id_categoria" value={form.id_categoria} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40">
                <option value="">Seleccionar...</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[0.8rem] mb-1 text-ink-muted">Marca *</label>
              <select name="id_marca" value={form.id_marca} onChange={handleChange} className="w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-market/40">
                <option value="">Seleccionar...</option>
                {marcas.map((m) => (
                  <option key={m.id_marca} value={m.id_marca}>{m.nombre_marca}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <label className="text-[0.85rem] flex items-center gap-1.5 text-ink">
                <input type="checkbox" name="caducidad" checked={form.caducidad} onChange={handleChange} className="accent-market" /> Tiene caducidad
              </label>
              <label className="text-[0.85rem] flex items-center gap-1.5 text-ink">
                <input type="checkbox" name="exento_iva" checked={form.exento_iva} onChange={handleChange} className="accent-market" /> Exento de IVA
              </label>
              <label className="text-[0.85rem] flex items-center gap-1.5 text-ink">
                <input type="checkbox" name="estado_producto" checked={form.estado_producto} onChange={handleChange} className="accent-market" /> Activo
              </label>
            </div>
            {form.caducidad && (
              <div>
                <label style={lbl}>Fecha de caducidad</label>
                <input name="fecha_caducidad" type="date" value={form.fecha_caducidad} onChange={handleChange} style={inp} />
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                  Referencia general del producto (no por lote).
                </span>
              </div>
            )}
          </div>

          {/* ── Proveedor ─────────────────────────────────────────────── */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <label style={lbl}>Proveedores</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 240px", minWidth: 220 }}>
                <input
                  style={inp}
                  placeholder="Buscar proveedor por nombre o NIT…"
                  value={proveedorQuery}
                  onChange={(e) => { setProveedorQuery(e.target.value); setProveedorSugerenciasAbiertas(true); }}
                  onFocus={() => setProveedorSugerenciasAbiertas(true)}
                  onBlur={() => setTimeout(() => setProveedorSugerenciasAbiertas(false), 150)}
                />
                {proveedorSugerenciasAbiertas && proveedorQuery.trim() !== "" && (
                  <div style={dropdown}>
                    {proveedoresFiltrados.length === 0 ? (
                      <div style={{ padding: "0.5rem 0.7rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                        Sin resultados — prueba &quot;+ Proveedor nuevo&quot;.
                      </div>
                    ) : (
                      proveedoresFiltrados.slice(0, 8).map((p) => (
                        <div key={p.id_proveedor} onMouseDown={() => agregarProveedor(p)} style={dropdownItem}>
                          {p.nombre_proveedor} <span style={{ color: "var(--muted)" }}>({p.nit_proveedor})</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCreandoProveedor((v) => !v)}
                style={{ ...btnGhost, whiteSpace: "nowrap" }}
              >
                + Proveedor nuevo
              </button>
            </div>

            {proveedoresSeleccionados.length > 0 && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                {proveedoresSeleccionados.map((p) => (
                  <span key={p.id_proveedor} style={chip}>
                    {p.nombre_proveedor}
                    <button
                      type="button"
                      onClick={() => quitarProveedor(p.id_proveedor)}
                      style={chipRemove}
                      aria-label={`Quitar ${p.nombre_proveedor}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {creandoProveedor && (
              <div style={{ marginTop: "0.75rem", padding: "0.85rem", background: "var(--surface2)", borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={lbl}>Nombre *</label>
                  <input value={formProveedorNuevo.nombre_proveedor} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, nombre_proveedor: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>NIT *</label>
                  <input value={formProveedorNuevo.nit_proveedor} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, nit_proveedor: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Correo</label>
                  <input value={formProveedorNuevo.correo_contacto} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, correo_contacto: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Teléfono</label>
                  <input value={formProveedorNuevo.telefono} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, telefono: e.target.value }))} style={inp} />
                </div>
                {errorProveedor && (
                  <div style={{ gridColumn: "1 / -1", color: "var(--red)", fontSize: "0.82rem" }}>{errorProveedor}</div>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <button type="button" onClick={guardarProveedorNuevo} disabled={guardandoProveedor} style={btnGhost}>
                    {guardandoProveedor ? "Guardando…" : "Guardar proveedor"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Presentaciones por mayor ──────────────────────────────── */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <label style={lbl}>Presentaciones por mayor (opcional{liquidoRequiereCaja ? ", obligatoria para líquidos" : ""})</label>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 0.6rem" }}>
              Ej. &quot;Caja de 24&quot; = 24 unidades base, &quot;Saco de 50&quot; = 50 libras base.
            </p>

            {presentacionesForm.map((p, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input
                  value={p.nombre_presentacion}
                  onChange={(e) => actualizarPresentacion(idx, "nombre_presentacion", e.target.value)}
                  placeholder="Ej: Caja de 24"
                  style={{ ...inp, flex: "1 1 200px" }}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={p.factor_conversion}
                  onChange={(e) => actualizarPresentacion(idx, "factor_conversion", e.target.value)}
                  placeholder="Cantidad de unidades base"
                  style={{ ...inp, width: 170 }}
                />
                <button type="button" onClick={() => quitarPresentacion(idx)} style={s.btnDel} title="Quitar">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => agregarFilaPresentacion()} style={btnGhost}>
                + Agregar presentación
              </button>
              {liquidoRequiereCaja && (
                <button type="button" onClick={() => agregarFilaPresentacion("Caja")} style={btnGhost}>
                  + Agregar caja
                </button>
              )}
              {esLibra && (
                <button type="button" onClick={() => agregarFilaPresentacion("Saco")} style={btnGhost}>
                  + Agregar saco
                </button>
              )}
            </div>
          </div>

          {mensajeForm && (
            <p className={`mt-4 text-sm font-medium ${exito ? "text-market-600 animate-stamp" : "text-achiote"}`}>
              {mensajeForm}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={guardando}
            className={`${th.head} mt-5 text-white border-none rounded-control px-6 py-2.5 text-sm font-semibold transition-transform duration-100 active:scale-[0.97] hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {guardando ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
        <table className="w-full border-collapse min-w-[760px]">
          <thead>
            <tr className={th.head}>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Código</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Producto</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Categoría</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Marca</th>
              <th className="px-3.5 py-2.5 text-right text-[0.82rem] font-semibold text-white">P. unit.</th>
              <th className="px-3.5 py-2.5 text-right text-[0.82rem] font-semibold text-white">P. mayoreo</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, i) => (
              <tr key={p.id_producto} className={i % 2 === 0 ? "bg-cream/40" : "bg-white"}>
                <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{p.codigo_producto}</td>
                <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{p.nombre_producto}</td>
                <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{p.nombre_categoria}</td>
                <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{p.nombre_marca}</td>
                <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)] text-right">Q{Number(p.precio_unitario).toFixed(2)}</td>
                <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)] text-right">Q{Number(p.precio_mayoreo).toFixed(2)}</td>
                <td className="px-3.5 py-2.5 text-[0.88rem] border-b border-[var(--border)]">
                  {p.estado_producto
                    ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-market-50 text-market-600">Activo</span>
                    : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ink-faint/20 text-ink-muted">Inactivo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
