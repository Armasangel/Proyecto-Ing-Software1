"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { staffVariantFromTipo } from "@/lib/roles";

type ProductoInv = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  nombre_categoria: string;
  nombre_marca: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  stock_total: string;
  estado_producto: boolean;
};

const THEMES = {
  dueno: { rowHead: "#2d6a4f" },
  colaborador: { rowHead: "#4c6ef5" },
} as const;

export default function InventarioPage() {
  const usuario = useStaffSession();
  const [productos, setProductos] = useState<ProductoInv[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/inventario")
      .then((r) => r.json())
      .then((d) => {
        if (d?.productos) setProductos(d.productos);
        if (d?.error) setError(d.error);
      })
      .catch(() => setError("Error al cargar inventario"));
  }, [usuario]);

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const th = THEMES[staffVariantFromTipo(usuario.tipo_usuario)];

  return (
    <StaffShell
      usuario={usuario}
      title="Inventario"
      subtitle="Productos con precios y existencias en bodega"
    >
      {error && (
        <p style={{ color: "var(--red)", marginBottom: "1rem" }}>{error}</p>
      )}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--surface)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: th.rowHead, color: "#fff" }}>
              <th style={cellH}>Código</th>
              <th style={cellH}>Producto</th>
              <th style={cellH}>Categoría</th>
              <th style={cellH}>Marca</th>
              <th style={{ ...cellH, textAlign: "right" }}>Stock</th>
              <th style={{ ...cellH, textAlign: "right" }}>P. unit.</th>
              <th style={{ ...cellH, textAlign: "right" }}>P. mayoreo</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p, i) => (
              <tr
                key={p.id_producto}
                style={{
                  background: i % 2 === 0 ? "var(--surface2)" : "var(--surface)",
                }}
              >
                <td style={cell}>{p.codigo_producto}</td>
                <td style={cell}>{p.nombre_producto}</td>
                <td style={cell}>{p.nombre_categoria}</td>
                <td style={cell}>{p.nombre_marca}</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>
                  {Number(p.stock_total).toLocaleString("es-GT", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                    {p.unidad_medida}
                  </span>
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  Q{Number(p.precio_unitario).toFixed(2)}
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  Q{Number(p.precio_mayoreo).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

const cell: React.CSSProperties = {
  padding: "0.65rem 0.85rem",
  fontSize: "0.88rem",
  borderBottom: "1px solid var(--border)",
};

const cellH: React.CSSProperties = {
  ...cell,
  textAlign: "left",
  fontWeight: 600,
  fontSize: "0.82rem",
};
