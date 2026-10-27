"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CategoriaAutocompletar } from "@/components/inventario-catalogo/CategoriaAutocompletar";
import { MarcaAutocompletar } from "@/components/inventario-catalogo/MarcaAutocompletar";
import { PresentacionesProducto } from "@/components/inventario-catalogo/PresentacionesProducto";
import { matchesQuery } from "@/lib/ui-table";
import {
  normalizarUnidad,
  presentacionesIniciales,
  validarPresentaciones,
  type Presentacion,
} from "@/lib/presentaciones";
import { validarCategoriasProducto } from "@/lib/producto-categorias";

export type ProveedorRapido = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor?: string | null;
  correo_contacto?: string | null;
  telefono?: string | null;
};

type Categoria = {
  id_categoria: number;
  nombre_categoria: string;
};

type Marca = {
  id_marca: number;
  nombre_marca: string;
  usos?: number;
};

type Props = {
  proveedor?: ProveedorRapido;
  onCreado: (idProducto: number) => void;
  onCancelar: () => void;
};

const PROVEEDOR_VACIO = {
  nombre_proveedor: "",
  nit_proveedor: "",
  correo_contacto: "",
  telefono: "",
};

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

export function ProductoRapidoForm({ proveedor, onCreado, onCancelar }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorRapido[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<ProveedorRapido[]>(
    () => (proveedor ? [proveedor] : [])
  );
  const [proveedorQuery, setProveedorQuery] = useState("");
  const [proveedorSugerenciasAbiertas, setProveedorSugerenciasAbiertas] = useState(false);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [formProveedorNuevo, setFormProveedorNuevo] = useState(PROVEEDOR_VACIO);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [errorProveedor, setErrorProveedor] = useState("");
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [categoriaDestino, setCategoriaDestino] = useState<"id_categoria" | "id_categoria_2" | "id_categoria_3">("id_categoria");
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState("");
  const [creandoMarca, setCreandoMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState("");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [errorMarca, setErrorMarca] = useState("");
  const [presentacionesForm, setPresentacionesForm] = useState<Presentacion[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const unidadBase = normalizarUnidad(form.unidad_medida);

  useEffect(() => {
    let activo = true;
    Promise.all([
      fetch("/api/categorias").then((r) => r.json()),
      fetch("/api/marcas").then((r) => r.json()),
      fetch("/api/proveedores").then((r) => (r.ok ? r.json() : { proveedores: [] })),
    ])
      .then(([dataCategorias, dataMarcas, dataProveedores]) => {
        if (!activo) return;
        setCategorias(Array.isArray(dataCategorias.categorias) ? dataCategorias.categorias : []);
        setMarcas(Array.isArray(dataMarcas.marcas) ? dataMarcas.marcas : []);
        setProveedores(Array.isArray(dataProveedores.proveedores) ? dataProveedores.proveedores : []);
      })
      .catch(() => {
        if (activo) setFormError("No se pudieron cargar categorías, marcas o proveedores");
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    setPresentacionesForm(presentacionesIniciales(unidadBase));
  }, [unidadBase]);

  const proveedoresFiltrados = useMemo(
    () => proveedores.filter(
      (p) =>
        !proveedoresSeleccionados.some((s) => s.id_proveedor === p.id_proveedor) &&
        matchesQuery(proveedorQuery, p.nombre_proveedor, p.nit_proveedor)
    ),
    [proveedores, proveedoresSeleccionados, proveedorQuery]
  );

  const agregarProveedor = (p: ProveedorRapido) => {
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
        setCategorias((prev) =>
          [...prev, data.categoria].sort((a, b) => a.nombre_categoria.localeCompare(b.nombre_categoria))
        );
        setForm((f) => ({ ...f, [categoriaDestino]: String(data.categoria.id_categoria) }));
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
        setMarcas((prev) =>
          [...prev, data.marca].sort((a, b) => a.nombre_marca.localeCompare(b.nombre_marca))
        );
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

  const handleGuardar = async () => {
    if (saving || guardandoCategoria || guardandoMarca || guardandoProveedor) return;
    if (!form.codigo_producto || !form.nombre_producto || !form.unidad_medida || !form.id_categoria || !form.id_marca) {
      setFormError("Completa todos los campos obligatorios (*)");
      return;
    }
    if (!form.estado_producto) {
      setFormError("El producto debe estar activo para seleccionarlo en la compra.");
      return;
    }
    const errorCategorias = validarCategoriasProducto([
      Number(form.id_categoria),
      form.id_categoria_2 ? Number(form.id_categoria_2) : null,
      form.id_categoria_3 ? Number(form.id_categoria_3) : null,
    ]);
    if (errorCategorias) {
      setFormError(errorCategorias);
      return;
    }
    const errorPresentaciones = validarPresentaciones(presentacionesForm);
    if (errorPresentaciones) {
      setFormError(errorPresentaciones);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
        precio_mayoreo: form.precio_mayoreo ? Number(form.precio_mayoreo) : null,
        fecha_caducidad: form.caducidad && form.fecha_caducidad ? form.fecha_caducidad : null,
        id_categoria: Number(form.id_categoria),
        id_categoria_2: form.id_categoria_2 ? Number(form.id_categoria_2) : null,
        id_categoria_3: form.id_categoria_3 ? Number(form.id_categoria_3) : null,
        id_marca: Number(form.id_marca),
        id_proveedores: proveedoresSeleccionados.map((p) => p.id_proveedor),
        presentaciones: presentacionesForm,
      };
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Error al guardar");
      } else {
        onCreado(Number(data.id_producto));
      }
    } catch {
      setFormError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const ocupado = saving || guardandoCategoria || guardandoMarca || guardandoProveedor;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div style={fila}>
        <Field label="Código *" style={{ flex: "0 0 140px" }}>
          <input
            aria-label="Código del producto"
            maxLength={50}
            style={campo}
            value={form.codigo_producto}
            onChange={(e) => setForm((f) => ({ ...f, codigo_producto: e.target.value }))}
            placeholder="ARR-001"
            autoFocus
          />
        </Field>
        <Field label="Nombre del producto *" style={{ flex: 1 }}>
          <input
            aria-label="Nombre del producto"
            maxLength={200}
            style={campo}
            value={form.nombre_producto}
            onChange={(e) => setForm((f) => ({ ...f, nombre_producto: e.target.value }))}
            placeholder="Arroz 1 libra"
          />
        </Field>
      </div>

      <div style={fila}>
        {([
          { key: "id_categoria", label: "Categoría principal *", numero: 1 },
          { key: "id_categoria_2", label: "Categoría 2 (opcional)", numero: 2 },
          { key: "id_categoria_3", label: "Categoría 3 (opcional)", numero: 3 },
        ] as const).map(({ key, label, numero }) => (
          <Field key={key} label={label} style={{ flex: "1 1 170px" }}>
            <CategoriaAutocompletar
              ariaLabel={label}
              style={campo}
              value={form[key]}
              disabled={saving || guardandoCategoria}
              opcional={numero !== 1}
              categorias={categorias.filter(
                (c) =>
                  !["id_categoria", "id_categoria_2", "id_categoria_3"].some(
                    (otra) => otra !== key && form[otra as typeof key] === String(c.id_categoria)
                  )
              )}
              onChange={(id) => setForm((f) => ({ ...f, [key]: id }))}
            />
            <button
              type="button"
              style={botonSecundario}
              disabled={saving || guardandoCategoria}
              onClick={() => {
                setCategoriaDestino(key);
                setCreandoCategoria(true);
                setNuevaCategoriaNombre("");
                setErrorCategoria("");
              }}
            >
              + Crear categoría {numero}
            </button>
          </Field>
        ))}
      </div>

      {creandoCategoria && (
        <div style={panel}>
          <Field label={`Nueva categoría para ${categoriaDestino === "id_categoria" ? "categoría principal" : categoriaDestino === "id_categoria_2" ? "categoría 2" : "categoría 3"}`}>
            <input
              aria-label="Nombre de nueva categoría"
              style={campo}
              maxLength={100}
              value={nuevaCategoriaNombre}
              onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
              disabled={guardandoCategoria}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!guardandoCategoria) void guardarCategoriaNueva();
                }
              }}
            />
          </Field>
          {errorCategoria && <p role="alert" style={error}>{errorCategoria}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => void guardarCategoriaNueva()} disabled={guardandoCategoria} style={botonPrimario}>
              {guardandoCategoria ? "Creando..." : "Crear categoría"}
            </button>
            <button type="button" onClick={() => setCreandoCategoria(false)} disabled={guardandoCategoria} style={botonSecundario}>
              Cancelar categoría
            </button>
          </div>
        </div>
      )}

      <div style={fila}>
        <Field label="Marca *" style={{ flex: 1 }}>
          <MarcaAutocompletar
            marcas={marcas}
            style={campo}
            value={form.id_marca}
            disabled={saving || guardandoMarca}
            onChange={(id) => setForm((f) => ({ ...f, id_marca: id }))}
          />
          <button
            type="button"
            onClick={() => {
              setCreandoMarca(true);
              setNuevaMarcaNombre("");
              setErrorMarca("");
            }}
            disabled={saving || guardandoMarca}
            style={botonSecundario}
          >
            + Crear marca
          </button>
        </Field>
      </div>

      {creandoMarca && (
        <div style={panel}>
          <Field label="Nueva marca">
            <input
              aria-label="Nombre de nueva marca"
              style={campo}
              maxLength={100}
              value={nuevaMarcaNombre}
              onChange={(e) => setNuevaMarcaNombre(e.target.value)}
              disabled={guardandoMarca}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!guardandoMarca) void guardarMarcaNueva();
                }
              }}
            />
          </Field>
          {errorMarca && <p role="alert" style={error}>{errorMarca}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => void guardarMarcaNueva()} disabled={guardandoMarca} style={botonPrimario}>
              {guardandoMarca ? "Creando..." : "Crear marca"}
            </button>
            <button type="button" onClick={() => setCreandoMarca(false)} disabled={guardandoMarca} style={botonSecundario}>
              Cancelar marca
            </button>
          </div>
        </div>
      )}

      <div style={fila}>
        <Field label="Precio unitario" style={{ flex: 1 }}>
          <input
            aria-label="Precio unitario"
            style={campo}
            type="number"
            step="0.01"
            min="0"
            value={form.precio_unitario}
            onChange={(e) => setForm((f) => ({ ...f, precio_unitario: e.target.value }))}
            placeholder="0.00"
          />
        </Field>
        <Field label="Precio mayoreo" style={{ flex: 1 }}>
          <input
            aria-label="Precio mayoreo"
            style={campo}
            type="number"
            step="0.01"
            min="0"
            value={form.precio_mayoreo}
            onChange={(e) => setForm((f) => ({ ...f, precio_mayoreo: e.target.value }))}
            placeholder="0.00"
          />
        </Field>
        <Field label="Unidad de medida *" style={{ flex: 1 }}>
          <input
            aria-label="Unidad de medida"
            disabled={saving}
            style={campo}
            value={form.unidad_medida}
            onChange={(e) => setForm((f) => ({ ...f, unidad_medida: e.target.value }))}
            placeholder="libra, botella, unidad..."
          />
        </Field>
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
        Los líquidos se venden por botella. Registra cada tamaño (800 ml, 1 L, etc.) como un producto distinto; las cajas agrupan botellas del mismo producto.
      </p>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", color: "var(--text)" }}>
        <CheckField label="Producto con fecha de caducidad" checked={form.caducidad} onChange={(v) => setForm((f) => ({ ...f, caducidad: v }))} />
        <CheckField label="Exento de IVA" checked={form.exento_iva} onChange={(v) => setForm((f) => ({ ...f, exento_iva: v }))} />
        <CheckField label="Producto activo" checked={form.estado_producto} onChange={(v) => setForm((f) => ({ ...f, estado_producto: v }))} />
      </div>

      {form.caducidad && (
        <Field label="Fecha de caducidad" style={{ maxWidth: 220 }}>
          <input
            aria-label="Fecha de caducidad del producto"
            style={campo}
            type="date"
            value={form.fecha_caducidad}
            onChange={(e) => setForm((f) => ({ ...f, fecha_caducidad: e.target.value }))}
          />
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Referencia general del producto (no por lote).</span>
        </Field>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Proveedores
        </span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <input
              aria-label="Buscar proveedor"
              style={campo}
              placeholder="Buscar proveedor por nombre o NIT..."
              value={proveedorQuery}
              onChange={(e) => {
                setProveedorQuery(e.target.value);
                setProveedorSugerenciasAbiertas(true);
              }}
              onFocus={() => setProveedorSugerenciasAbiertas(true)}
              onBlur={() => setTimeout(() => setProveedorSugerenciasAbiertas(false), 150)}
            />
            {proveedorSugerenciasAbiertas && proveedorQuery.trim() !== "" && (
              <div style={sugerencias}>
                {proveedoresFiltrados.length === 0 ? (
                  <div style={{ padding: "0.5rem 0.7rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                    Sin resultados. Prueba &quot;+ Proveedor nuevo&quot;.
                  </div>
                ) : (
                  proveedoresFiltrados.slice(0, 8).map((p) => (
                    <div
                      key={p.id_proveedor}
                      onMouseDown={() => agregarProveedor(p)}
                      style={{ padding: "0.45rem 0.7rem", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--border)" }}
                    >
                      {p.nombre_proveedor} <span style={{ color: "var(--muted)" }}>({p.nit_proveedor})</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setCreandoProveedor((v) => !v)} style={botonSecundario}>
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
                  aria-label={`Quitar ${p.nombre_proveedor}`}
                  onClick={() => quitarProveedor(p.id_proveedor)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {creandoProveedor && (
          <div style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem" }}>
            <Field label="Nombre *">
              <input style={campo} value={formProveedorNuevo.nombre_proveedor} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, nombre_proveedor: e.target.value }))} />
            </Field>
            <Field label="NIT *">
              <input style={campo} value={formProveedorNuevo.nit_proveedor} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, nit_proveedor: e.target.value }))} />
            </Field>
            <Field label="Correo">
              <input style={campo} value={formProveedorNuevo.correo_contacto} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, correo_contacto: e.target.value }))} />
            </Field>
            <Field label="Teléfono">
              <input style={campo} value={formProveedorNuevo.telefono} onChange={(e) => setFormProveedorNuevo((f) => ({ ...f, telefono: e.target.value }))} />
            </Field>
            {errorProveedor && <div style={{ gridColumn: "1 / -1", color: "var(--red)", fontSize: "0.82rem" }}>{errorProveedor}</div>}
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="button" onClick={() => void guardarProveedorNuevo()} disabled={guardandoProveedor} style={botonPrimario}>
                {guardandoProveedor ? "Guardando..." : "Guardar proveedor"}
              </button>
            </div>
          </div>
        )}
      </div>

      <PresentacionesProducto
        unidad={form.unidad_medida}
        value={presentacionesForm}
        onChange={setPresentacionesForm}
        disabled={saving}
      />

      {formError && <p role="alert" style={error}>{formError}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <button type="button" onClick={onCancelar} style={botonSecundario} disabled={ocupado}>
          Cancelar
        </button>
        <button type="button" onClick={() => void handleGuardar()} style={botonPrimario} disabled={ocupado}>
          {saving ? "Guardando..." : "Crear producto"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", ...style }}>
      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
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

const fila: CSSProperties = { display: "flex", gap: "0.75rem", flexWrap: "wrap" };
const campo: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.6rem 0.7rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: "0.85rem",
};
const botonPrimario: CSSProperties = {
  background: "var(--accent)",
  color: "#0d1117",
  border: "none",
  borderRadius: 6,
  padding: "0.55rem 0.9rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
};
const botonSecundario: CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "0.5rem 0.75rem",
  fontSize: "0.82rem",
  cursor: "pointer",
  color: "var(--muted)",
};
const panel: CSSProperties = {
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface2)",
};
const error: CSSProperties = { color: "var(--red)", fontSize: "0.82rem", margin: 0 };
const sugerencias: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  marginTop: 2,
  zIndex: 20,
  maxHeight: 180,
  overflowY: "auto",
  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
};
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "0.25rem 0.6rem",
  fontSize: "0.8rem",
};
