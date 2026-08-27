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
