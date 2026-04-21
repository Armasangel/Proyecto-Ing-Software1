"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_USUARIO, postLoginPath } from "@/lib/roles";

type CatalogoItem = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
  nombre_categoria: string;
  nombre_marca: string;
  stock_total: number;
  precio: number;
};

type Usuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

type CartLine = { id: number; nombre: string; precio: number; qty: number; unidad: string };

export default function TiendaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [productos, setProductos] = useState<CatalogoItem[]>([]);
  const [cart, setCart] = useState<Record<number, CartLine>>({});
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sesion")
      .then((r) => r.json())
      .then((d) => {
        if (!d.usuario) {
          router.replace("/login");
          return;
        }
        if (d.usuario.tipo_usuario !== TIPOS_USUARIO.COMPRADOR) {
          router.replace(postLoginPath(d.usuario.tipo_usuario));
          return;
        }
        setUsuario(d.usuario);
      });
  }, [router]);

  useEffect(() => {
    fetch("/api/tienda/catalogo")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setProductos(d.productos || []);
      })
      .catch(() => setError("No se pudo cargar el catálogo"));
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre_producto.toLowerCase().includes(q) ||
        p.codigo_producto.toLowerCase().includes(q) ||
        p.nombre_categoria.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  function addToCart(p: CatalogoItem) {
    if (p.stock_total <= 0) return;
    setCart((prev) => {
      const cur = prev[p.id_producto];
      const nextQty = (cur?.qty ?? 0) + 1;
      if (nextQty > p.stock_total) return prev;
      return {
        ...prev,
        [p.id_producto]: {
          id: p.id_producto,
          nombre: p.nombre_producto,
          precio: p.precio,
          unidad: p.unidad_medida,
          qty: nextQty,
        },
      };
    });
  }

  function updateQty(id: number, delta: number) {
    setCart((prev) => {
      const line = prev[id];
      if (!line) return prev;
      const p = productos.find((x) => x.id_producto === id);
      const max = p?.stock_total ?? line.qty;
      const next = line.qty + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      if (next > max) return prev;
      return { ...prev, [id]: { ...line, qty: next } };
    });
  }

  const lines = Object.values(cart);
  const subtotal = lines.reduce((s, l) => s + l.precio * l.qty, 0);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!usuario) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Cargando…</div>;
  }

  return (
    <div style={shell}>
      <header style={header}>
        <div>
          <h1 style={logo}>Tienda en línea</h1>
          <p style={tag}>Precios al público · inventario en tiempo real</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "#4a3728", fontSize: "0.9rem" }}>
            Hola, <strong>{usuario.nombre.split(" ")[0]}</strong>
          </span>
          <button type="button" onClick={logout} style={btnGhost}>
            Salir
          </button>
        </div>
      </header>

      <div style={layout}>
        <section style={{ flex: 1, minWidth: 0 }}>
          <div style={toolbar}>
            <input
              type="search"
              placeholder="Buscar producto, código o categoría…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={search}
            />
          </div>
          {error && <p style={{ color: "#b42318" }}>{error}</p>}
          <div style={grid}>
            {filtrados.map((p) => (
              <article key={p.id_producto} style={card}>
                <div style={cardBadge}>{p.nombre_categoria}</div>
                <h2 style={cardTitle}>{p.nombre_producto}</h2>
                <p style={cardMeta}>
                  {p.nombre_marca} · {p.codigo_producto}
                </p>
                <p style={price}>Q{p.precio.toFixed(2)}</p>
                <p style={stock}>
                  {p.stock_total > 0 ? (
                    <>
                      <span style={{ color: "#2d6a4f" }}>Disponible:</span>{" "}
                      {p.stock_total.toLocaleString("es-GT", { maximumFractionDigits: 2 })}{" "}
                      {p.unidad_medida}
                    </>
                  ) : (
                    <span style={{ color: "#b42318" }}>Agotado</span>
                  )}
                </p>
                <button
                  type="button"
                  disabled={p.stock_total <= 0}
                  onClick={() => addToCart(p)}
                  style={{
                    ...btnPrimary,
                    opacity: p.stock_total <= 0 ? 0.45 : 1,
                    cursor: p.stock_total <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Añadir al carrito
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside style={cartPanel}>
          <h3 style={cartTitle}>Carrito</h3>
          {lines.length === 0 ? (
            <p style={{ color: "#6b5b4b", fontSize: "0.9rem" }}>
              Tu carrito está vacío. Los pedidos en línea son una vista demo: aquí solo
              armamos el detalle; el cobro y la entrega los confirma la tienda.
            </p>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {lines.map((l) => (
                  <li key={l.id} style={cartLine}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#2c2418" }}>{l.nombre}</div>
                      <div style={{ fontSize: "0.82rem", color: "#6b5b4b" }}>
                        Q{l.precio.toFixed(2)} × {l.qty} {l.unidad}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <button type="button" style={qtyBtn} onClick={() => updateQty(l.id, -1)}>
                        −
                      </button>
                      <span style={{ minWidth: 22, textAlign: "center" }}>{l.qty}</span>
                      <button type="button" style={qtyBtn} onClick={() => updateQty(l.id, 1)}>
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div style={cartTotal}>
                <span>Subtotal estimado</span>
                <strong>Q{subtotal.toFixed(2)}</strong>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(165deg, #fff9f0 0%, #f5e6d3 45%, #e8dcc8 100%)",
  color: "#2c2418",
  fontFamily: "var(--font-body)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1.25rem 2rem",
  borderBottom: "1px solid rgba(74,55,40,0.12)",
  background: "rgba(255,255,255,0.65)",
  backdropFilter: "blur(8px)",
  flexWrap: "wrap",
  gap: "1rem",
};

const logo: React.CSSProperties = {
  fontFamily: "var(--font-head)",
  fontSize: "1.5rem",
  fontWeight: 800,
  color: "#c45c26",
  margin: 0,
};

const tag: React.CSSProperties = {
  margin: "0.15rem 0 0",
  fontSize: "0.88rem",
  color: "#6b5b4b",
};

const layout: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  padding: "1.5rem 2rem 3rem",
  maxWidth: 1200,
  margin: "0 auto",
  alignItems: "flex-start",
};

const toolbar: React.CSSProperties = { marginBottom: "1rem" };

const search: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  padding: "0.65rem 1rem",
  borderRadius: 999,
  border: "1px solid rgba(74,55,40,0.2)",
  fontSize: "0.95rem",
  outline: "none",
  background: "#fff",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "1rem",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: "1.25rem",
  boxShadow: "0 8px 28px rgba(44,36,24,0.08)",
  border: "1px solid rgba(74,55,40,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const cardBadge: React.CSSProperties = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#8a6d4d",
  fontWeight: 600,
};

const cardTitle: React.CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.3,
  color: "#2c2418",
};

const cardMeta: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "#6b5b4b",
  margin: 0,
};

const price: React.CSSProperties = {
  fontSize: "1.35rem",
  fontWeight: 800,
  color: "#2d6a4f",
  margin: "0.35rem 0 0",
};

const stock: React.CSSProperties = {
  fontSize: "0.85rem",
  margin: "0 0 0.75rem",
};

const btnPrimary: React.CSSProperties = {
  marginTop: "auto",
  background: "linear-gradient(135deg, #c45c26, #e8742e)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "0.65rem 1rem",
  fontWeight: 700,
  fontSize: "0.88rem",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(74,55,40,0.25)",
  borderRadius: 8,
  padding: "0.45rem 0.9rem",
  cursor: "pointer",
  color: "#4a3728",
};

const cartPanel: React.CSSProperties = {
  width: 320,
  flexShrink: 0,
  background: "#fff",
  borderRadius: 16,
  padding: "1.25rem",
  boxShadow: "0 8px 28px rgba(44,36,24,0.08)",
  border: "1px solid rgba(74,55,40,0.08)",
  position: "sticky",
  top: "1rem",
};

const cartTitle: React.CSSProperties = {
  fontFamily: "var(--font-head)",
  margin: "0 0 1rem",
  fontSize: "1.1rem",
  color: "#2c2418",
};

const cartLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.65rem 0",
  borderBottom: "1px solid rgba(74,55,40,0.08)",
};

const qtyBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid rgba(74,55,40,0.2)",
  background: "#faf6f0",
  cursor: "pointer",
  fontWeight: 700,
};

const cartTotal: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "2px solid rgba(196,92,38,0.35)",
  fontSize: "1rem",
  color: "#2c2418",
};
