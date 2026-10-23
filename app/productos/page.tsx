"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo } from "@/lib/roles";
import { FormularioProducto } from "@/components/productos/FormularioProducto";

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

/* Acento por rol — coherente con StaffShell */
const THEMES = {
  dueno: { head: "bg-mango-600", headText: "text-mango-600" },
  colaborador: { head: "bg-market-600", headText: "text-market-600" },
} as const;

export default function ProductosPage() {
  const usuario = useStaffSession();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

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
    if (usuario) cargarProductos();
  }, [usuario]);

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  const th = THEMES[staffVariantFromTipo(usuario.tipo_usuario)];

  return (
    <StaffShell
      usuario={usuario}
      title="Productos"
      subtitle="Catálogo maestro (precios, categoría y estado)"
    >
      {error && <p className="text-achiote mb-4">{error}</p>}

      <div className="mb-5">
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className={`${th.head} text-white border-none rounded-control px-5 py-2.5 text-sm font-semibold transition-transform duration-100 active:scale-[0.97] hover:brightness-110`}
        >
          {mostrarForm ? "✕ Cancelar" : "+ Agregar producto"}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-[var(--border)] rounded-card shadow-warm p-6 mb-6 max-w-[700px]">
          <h3 className="mb-4 text-base font-semibold text-ink">Nuevo producto</h3>
          <FormularioProducto
            onGuardado={() => {
              setMostrarForm(false);
              cargarProductos();
            }}
          />
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
