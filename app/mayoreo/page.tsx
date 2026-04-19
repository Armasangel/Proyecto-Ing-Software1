"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_USUARIO, postLoginPath } from "@/lib/roles";

type Row = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
  nombre_categoria: string;
  nombre_marca: string;
  stock_total: number;
  precio_unitario: number;
  precio_mayoreo: number;
  precio: number;
};

type Usuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

export default function MayoreoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    fetch("/api/sesion")
      .then((r) => r.json())
      .then((d) => {
        if (!d.usuario) {
          router.replace("/login");
          return;
        }
        if (d.usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR_MAYOR) {
          router.replace(postLoginPath(d.usuario.tipo_usuario));
          return;
        }
        setUsuario(d.usuario);
      });
  }, [router]);

  useEffect(() => {
    fetch("/api/tienda/catalogo")
      .then((r) => r.json())
      .then((d) => setRows(d.productos || []));
  }, []);

  const data = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.nombre_producto.toLowerCase().includes(q) ||
        r.codigo_producto.toLowerCase().includes(q) ||
        r.nombre_categoria.toLowerCase().includes(q)
    );
  }, [rows, filtro]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "1.25rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--surface)",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-head)",
              fontSize: "1.45rem",
              fontWeight: 800,
              color: "#a5b4fc",
              margin: 0,
            }}
          >
            Lista mayorista
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "0.25rem 0 0" }}>
            Precios por volumen · {usuario.nombre}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar lista…"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.85rem",
              color: "var(--text)",
              minWidth: 200,
            }}
          />
          <button type="button" onClick={logout} style={btnOut}>
            Salir
          </button>
        </div>
      </header>

      <main style={{ padding: "1.5rem 2rem 3rem", maxWidth: 1100, margin: "0 auto" }}>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.88rem",
            marginBottom: "1.25rem",
            maxWidth: 720,
            lineHeight: 1.55,
          }}
        >
          Vista orientada a compradores al por mayor: una sola lista con código, categoría,
          existencias y precio mayoreo. El precio al detalle se muestra solo como referencia.
        </p>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th style={th}>Código</th>
                <th style={th}>Producto</th>
                <th style={th}>Categoría</th>
                <th style={{ ...th, textAlign: "right" }}>Stock</th>
                <th style={{ ...th, textAlign: "right" }}>P. público</th>
                <th style={{ ...th, textAlign: "right", color: "#a5b4fc" }}>P. mayoreo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={r.id_producto}
                  style={{
                    background: i % 2 === 0 ? "var(--surface)" : "rgba(22,27,34,0.6)",
                  }}
                >
                  <td style={td}>{r.codigo_producto}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {r.nombre_producto}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {r.nombre_marca}
                    </div>
                  </td>
                  <td style={td}>{r.nombre_categoria}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {r.stock_total.toLocaleString("es-GT", { maximumFractionDigits: 2 })}{" "}
                    <span style={{ color: "var(--muted)" }}>{r.unidad_medida}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "var(--muted)" }}>
                    Q{r.precio_unitario.toFixed(2)}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#c4d0ff",
                      fontSize: "0.95rem",
                    }}
                  >
                    Q{r.precio_mayoreo.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 1rem",
  fontWeight: 600,
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "0.65rem 1rem",
  borderTop: "1px solid var(--border)",
  verticalAlign: "top",
};

const btnOut: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  borderRadius: 8,
  padding: "0.45rem 0.9rem",
  cursor: "pointer",
  fontSize: "0.85rem",
};
