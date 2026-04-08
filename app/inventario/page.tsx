"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const COLORES: Record<string, string> = {
  DUENO:     "#1a6b3a",
  EMPLEADO:  "#1a4a8a",
  COMPRADOR: "#8a1a1a",
};

export default function InventarioPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<any[]>([]);
  const [usuario, setUsuario] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sesion")
      .then(r => r.json())
      .then(d => {
        if (!d.usuario) { router.push("/login"); return; }
        setUsuario(d.usuario);
      });
    fetch("/api/productos")
      .then(r => r.json())
      .then(d => setProductos(d.productos || []))
      .catch(() => setError("Error al cargar productos"));
  }, []);

  if (!usuario) return <p style={{ padding: "2rem" }}>Cargando...</p>;

  const color = COLORES[usuario.tipo_usuario] || "#333";

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ color }}>🏪 Tienda San Miguel — Inventario</h1>
      <p style={{ background: color, color: "white", display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: 4, marginBottom: "1.5rem" }}>
        {usuario.nombre} ({usuario.tipo_usuario})
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: color, color: "white" }}>
            <th style={{ padding: "0.5rem", textAlign: "left" }}>Codigo</th>
            <th style={{ padding: "0.5rem", textAlign: "left" }}>Producto</th>
            <th style={{ padding: "0.5rem", textAlign: "left" }}>Categoria</th>
            <th style={{ padding: "0.5rem", textAlign: "left" }}>Marca</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Precio Unit.</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Precio Mayor.</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p, i) => (
            <tr key={p.id_producto} style={{ background: i % 2 === 0 ? "#f9f9f9" : "white" }}>
              <td style={{ padding: "0.5rem" }}>{p.codigo_producto}</td>
              <td style={{ padding: "0.5rem" }}>{p.nombre_producto}</td>
              <td style={{ padding: "0.5rem" }}>{p.nombre_categoria}</td>
              <td style={{ padding: "0.5rem" }}>{p.nombre_marca}</td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>Q{p.precio_unitario}</td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>Q{p.precio_mayoreo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
