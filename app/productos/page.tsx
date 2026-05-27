"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo } from "@/lib/roles";

type Fila = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  estado_producto: boolean;
  nombre_categoria: string;
  nombre_marca: string;
};

type Categoria = { id_categoria: number; nombre_categoria: string };
type Marca = { id_marca: number; nombre_marca: string };

const THEMES = {
  dueno: { head: "#2d6a4f" },
  colaborador: { head: "#4c6ef5" },
} as const;

const formInicial = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  estado_producto: true,
  caducidad: false,
  exento_iva: false,
  id_categoria: "",
  id_marca: "",
};

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
  }, [usuario]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  };

  const handleSubmit = async () => {
    setGuardando(true);
    setMensajeForm("");
    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
          precio_mayoreo: form.precio_mayoreo ? Number(form.precio_mayoreo) : null,
          id_categoria: Number(form.id_categoria),
          id_marca: Number(form.id_marca),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensajeForm(data.error || "Error al guardar");
      } else {
        setMensajeForm("✓ Producto agregado correctamente");
        setForm(formInicial);
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
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const th = THEMES[staffVariantFromTipo(usuario.tipo_usuario)];

  return (
    <StaffShell
      usuario={usuario}
      title="Productos"
      subtitle="Catálogo maestro (precios, categoría y estado)"
    >
      {error && (
        <p style={{ color: "var(--red)", marginBottom: "1rem" }}>{error}</p>
      )}

      <div style={{ marginBottom: "1.25rem" }}>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setMensajeForm(""); }}
          style={{
            background: th.head,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.55rem 1.2rem",
            fontSize: "0.9rem",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {mostrarForm ? "✕ Cancelar" : "+ Agregar producto"}
        </button>
      </div>

      {mostrarForm && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.5rem",
          marginBottom: "1.5rem",
          maxWidth: 700,
        }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Nuevo producto</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={lbl}>Código *</label>
              <input name="codigo_producto" value={form.codigo_producto} onChange={handleChange} style={inp} placeholder="Ej: PROD-001" />
            </div>
            <div>
              <label style={lbl}>Nombre *</label>
              <input name="nombre_producto" value={form.nombre_producto} onChange={handleChange} style={inp} placeholder="Nombre del producto" />
            </div>
            <div>
              <label style={lbl}>Precio unitario</label>
              <input name="precio_unitario" type="number" value={form.precio_unitario} onChange={handleChange} style={inp} placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>Precio mayoreo</label>
              <input name="precio_mayoreo" type="number" value={form.precio_mayoreo} onChange={handleChange} style={inp} placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>Unidad de medida *</label>
              <input name="unidad_medida" value={form.unidad_medida} onChange={handleChange} style={inp} placeholder="Ej: unidad, caja, kg" />
            </div>
            <div>
              <label style={lbl}>Categoría *</label>
              <select name="id_categoria" value={form.id_categoria} onChange={handleChange} style={inp}>
                <option value="">Seleccionar...</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Marca *</label>
              <select name="id_marca" value={form.id_marca} onChange={handleChange} style={inp}>
                <option value="">Seleccionar...</option>
                {marcas.map((m) => (
                  <option key={m.id_marca} value={m.id_marca}>{m.nombre_marca}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", justifyContent: "center" }}>
              <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input type="checkbox" name="caducidad" checked={form.caducidad} onChange={handleChange} /> Tiene caducidad
              </label>
              <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input type="checkbox" name="exento_iva" checked={form.exento_iva} onChange={handleChange} /> Exento de IVA
              </label>
              <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input type="checkbox" name="estado_producto" checked={form.estado_producto} onChange={handleChange} /> Activo
              </label>
            </div>
          </div>

          {mensajeForm && (
            <p style={{ marginTop: "1rem", color: mensajeForm.startsWith("✓") ? "var(--green)" : "var(--red)", fontSize: "0.9rem" }}>
              {mensajeForm}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={guardando}
            style={{
              marginTop: "1.25rem",
              background: th.head,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.55rem 1.4rem",
              fontSize: "0.9rem",
              cursor: guardando ? "not-allowed" : "pointer",
              opacity: guardando ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {guardando ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      )}

      <div style={{
        overflowX: "auto",
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--surface)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ background: th.head, color: "#fff" }}>
              <th style={h}>Código</th>
              <th style={h}>Producto</th>
              <th style={h}>Categoría</th>
              <th style={h}>Marca</th>
              <th style={{ ...h, textAlign: "right" }}>P. unit.</th>
              <th style={{ ...h, textAlign: "right" }}>P. mayoreo</th>
              <th style={h}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, i) => (
              <tr key={p.id_producto} style={{ background: i % 2 === 0 ? "var(--surface2)" : "var(--surface)" }}>
                <td style={c}>{p.codigo_producto}</td>
                <td style={c}>{p.nombre_producto}</td>
                <td style={c}>{p.nombre_categoria}</td>
                <td style={c}>{p.nombre_marca}</td>
                <td style={{ ...c, textAlign: "right" }}>Q{Number(p.precio_unitario).toFixed(2)}</td>
                <td style={{ ...c, textAlign: "right" }}>Q{Number(p.precio_mayoreo).toFixed(2)}</td>
                <td style={c}>
                  {p.estado_producto
                    ? <span style={{ color: "var(--green)" }}>Activo</span>
                    : <span style={{ color: "var(--muted)" }}>Inactivo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

const h: React.CSSProperties = {
  padding: "0.65rem 0.85rem",
  textAlign: "left",
  fontSize: "0.82rem",
  fontWeight: 600,
};

const c: React.CSSProperties = {
  padding: "0.6rem 0.85rem",
  fontSize: "0.88rem",
  borderBottom: "1px solid var(--border)",
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  marginBottom: "0.3rem",
  color: "var(--muted)",
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.65rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: "0.88rem",
  boxSizing: "border-box",
};