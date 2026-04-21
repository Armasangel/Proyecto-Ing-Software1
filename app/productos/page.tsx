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

const THEMES = {
  dueno: { head: "#2d6a4f" },
  colaborador: { head: "#4c6ef5" },
} as const;

export default function ProductosPage() {
  const usuario = useStaffSession();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setFilas(d.productos || []);
      })
      .catch(() => setError("No se pudo cargar el catálogo interno"));
  }, [usuario]);

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
      <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: "1.25rem", maxWidth: 640 }}>
        Vista interna del catálogo. Altas, bajas y edición profunda de productos pueden enlazarse aquí en un
        siguiente sprint.
      </p>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--surface)",
        }}
      >
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
              <tr
                key={p.id_producto}
                style={{
                  background: i % 2 === 0 ? "var(--surface2)" : "var(--surface)",
                }}
              >
                <td style={c}>{p.codigo_producto}</td>
                <td style={c}>{p.nombre_producto}</td>
                <td style={c}>{p.nombre_categoria}</td>
                <td style={c}>{p.nombre_marca}</td>
                <td style={{ ...c, textAlign: "right" }}>
                  Q{Number(p.precio_unitario).toFixed(2)}
                </td>
                <td style={{ ...c, textAlign: "right" }}>
                  Q{Number(p.precio_mayoreo).toFixed(2)}
                </td>
                <td style={c}>
                  {p.estado_producto ? (
                    <span style={{ color: "var(--green)" }}>Activo</span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Inactivo</span>
                  )}
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
