"use client";
// app/inventario/page.tsx
// RF3 — Vista de inventario diferenciada por rol:
//   DUENO    → ve precio unitario, precio mayoreo y stock
//   EMPLEADO → ve precio unitario, precio mayoreo y stock
//   COMPRADOR→ solo ve producto, categoría y marca (sin precios)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";

interface Producto {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  nombre_categoria: string;
  nombre_marca: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  estado_producto: boolean;
}

interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
}

export default function InventarioPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    fetch("/api/sesion")
      .then((r) => r.json())
      .then((d) => {
        if (!d.usuario) {
          router.push("/login");
          return;
        }
        setUsuario(d.usuario);
      });

    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []))
      .catch(() => setError("Error al cargar productos"));
  }, [router]);

  if (!usuario) {
    return (
      <div style={{ padding: "2rem", color: "var(--muted)", fontFamily: "var(--font-body)" }}>
        Cargando…
      </div>
    );
  }

  // COMPRADOR no ve precios
  const verPrecios =
    usuario.tipo_usuario === "DUENO" || usuario.tipo_usuario === "EMPLEADO";

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre_producto.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo_producto.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.nombre_categoria.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.nombre_marca.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <>
      <Navbar usuario={usuario} />
      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.titulo}>Inventario</h1>
            <p style={s.subtitulo}>
              {productosFiltrados.length} producto
              {productosFiltrados.length !== 1 ? "s" : ""} encontrado
              {productosFiltrados.length !== 1 ? "s" : ""}
            </p>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, código, categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={s.searchInput}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

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
                    <th style={{ ...s.th, textAlign: "right" }}>Precio Unit.</th>
                    <th style={{ ...s.th, textAlign: "right" }}>Precio Mayor.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={verPrecios ? 7 : 5}
                    style={{ ...s.td, textAlign: "center", color: "var(--muted)", padding: "2rem" }}
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <tr key={p.id_producto} style={s.tr}>
                    <td style={s.td}>
                      <code style={s.code}>{p.codigo_producto}</code>
                    </td>
                    <td style={s.td}>{p.nombre_producto}</td>
                    <td style={s.td}>{p.nombre_categoria}</td>
                    <td style={s.td}>{p.nombre_marca}</td>
                    <td style={s.td}>{p.unidad_medida}</td>
                    {verPrecios && (
                      <>
                        <td style={{ ...s.td, textAlign: "right" }}>
                          Q{Number(p.precio_unitario).toFixed(2)}
                        </td>
                        <td style={{ ...s.td, textAlign: "right" }}>
                          Q{Number(p.precio_mayoreo).toFixed(2)}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  titulo: {
    fontFamily: "var(--font-head)",
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  },
  subtitulo: {
    color: "var(--muted)",
    fontSize: "0.85rem",
    marginTop: "0.25rem",
  },
  searchInput: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.6rem 1rem",
    color: "var(--text)",
    fontSize: "0.9rem",
    outline: "none",
    width: 280,
  },
  error: { color: "var(--red)", marginBottom: "1rem" },
  tableWrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    background: "var(--surface2)",
    color: "var(--muted)",
    fontFamily: "var(--font-body)",
    fontSize: "0.78rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.75rem 1rem",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding: "0.75rem 1rem",
    color: "var(--text)",
    fontSize: "0.9rem",
    verticalAlign: "middle",
  },
  code: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "0.1rem 0.4rem",
    fontSize: "0.8rem",
    color: "var(--accent)",
    fontFamily: "monospace",
  },
};