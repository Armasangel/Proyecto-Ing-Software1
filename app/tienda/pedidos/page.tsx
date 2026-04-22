"use client";
// app/tienda/pedidos/page.tsx
// Página donde el cliente ve sus reservas activas, total y fecha límite de pago

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ItemPedido = {
  nombre_producto: string;
  codigo_producto: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type Pedido = {
  id_venta: number;
  fecha_venta: string;
  estado_venta: string;
  tipo_venta: string;
  total: number;
  fecha_limite_pago: string;
  items: ItemPedido[];
};

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: "#c45c26",
  CONFIRMADO: "#2d6a4f",
  ENTREGADO: "#1a6b3a",
  PAGADO: "#6b5b4b",
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "⏳ Pendiente de pago",
  CONFIRMADO: "✅ Confirmado",
  ENTREGADO: "📦 Entregado",
  PAGADO: "💳 Pagado",
};

export default function PedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tienda/pedidos")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (data.error === "No autorizado") {
            router.replace("/login");
          } else {
            setError(data.error);
          }
        } else {
          setPedidos(data.pedidos || []);
        }
      })
      .catch(() => setError("No se pudo conectar con el servidor"))
      .finally(() => setLoading(false));
  }, [router]);

  function diasRestantes(fechaLimite: string) {
    const hoy = new Date();
    const limite = new Date(fechaLimite);
    const diff = Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  if (loading) {
    return <div style={styles.center}>Cargando pedidos…</div>;
  }

  return (
    <div style={styles.shell}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>Mis Pedidos</h1>
          <p style={styles.tag}>Reservas activas · Tienda San Miguel</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={() => router.push("/tienda")} style={styles.btnGhost}>
            ← Volver a la tienda
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {error && <div style={styles.alerta}>❌ {error}</div>}

        {pedidos.length === 0 && !error ? (
          <div style={styles.vacio}>
            <p style={{ fontSize: "3rem", margin: 0 }}>🛒</p>
            <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>No tienes reservas aún</p>
            <p style={{ color: "#6b5b4b", fontSize: "0.9rem" }}>
              Agrega productos al carrito y confirma tu pedido.
            </p>
            <button onClick={() => router.push("/tienda")} style={styles.btnPrimary}>
              Ir a la tienda
            </button>
          </div>
        ) : (
          <div style={styles.lista}>
            {pedidos.map((pedido) => {
              const dias = diasRestantes(pedido.fecha_limite_pago);
              const vencido = dias < 0;
              const urgente = dias >= 0 && dias <= 1;

              return (
                <div key={pedido.id_venta} style={styles.card}>
                  {/* Cabecera del pedido */}
                  <div style={styles.cardHeader}>
                    <div>
                      <span style={styles.pedidoId}>Pedido #{pedido.id_venta}</span>
                      <span
                        style={{
                          ...styles.badge,
                          color: ESTADO_COLOR[pedido.estado_venta] || "#333",
                          backgroundColor: `${ESTADO_COLOR[pedido.estado_venta]}18`,
                          border: `1px solid ${ESTADO_COLOR[pedido.estado_venta]}40`,
                        }}
                      >
                        {ESTADO_LABEL[pedido.estado_venta] || pedido.estado_venta}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={styles.total}>Q{Number(pedido.total).toFixed(2)}</div>
                      <div style={{ fontSize: "0.8rem", color: "#6b5b4b" }}>Total a pagar</div>
                    </div>
                  </div>

                  {/* Fecha límite */}
                  {pedido.estado_venta === "PENDIENTE" && (
                    <div
                      style={{
                        ...styles.fechaLimite,
                        backgroundColor: vencido ? "#fdecea" : urgente ? "#fff3e0" : "#f0faf4",
                        borderColor: vencido ? "#f5c2c7" : urgente ? "#ffcc80" : "#a3cfbb",
                        color: vencido ? "#842029" : urgente ? "#e65100" : "#0f5132",
                      }}
                    >
                      {vencido ? (
                        <>⚠️ Reserva vencida el {new Date(pedido.fecha_limite_pago).toLocaleDateString("es-GT")}</>
                      ) : urgente ? (
                        <>🔔 Paga hoy en tienda · vence {new Date(pedido.fecha_limite_pago).toLocaleDateString("es-GT")}</>
                      ) : (
                        <>
                          📅 Paga antes del{" "}
                          <strong>{new Date(pedido.fecha_limite_pago).toLocaleDateString("es-GT")}</strong>
                          {" "}· {dias} día{dias !== 1 ? "s" : ""} restante{dias !== 1 ? "s" : ""}
                        </>
                      )}
                    </div>
                  )}

                  {/* Detalle de productos */}
                  <table style={styles.tabla}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Producto</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Cant.</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Precio</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedido.items.map((item, i) => (
                        <tr key={i}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 600 }}>{item.nombre_producto}</div>
                            <div style={{ fontSize: "0.78rem", color: "#8a6d4d" }}>
                              {item.codigo_producto}
                            </div>
                          </td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            {item.cantidad} {item.unidad_medida}
                          </td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            Q{Number(item.precio_unitario).toFixed(2)}
                          </td>
                          <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
                            Q{Number(item.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Info pago en tienda */}
                  {pedido.estado_venta === "PENDIENTE" && (
                    <div style={styles.infoPago}>
                      <strong>💳 ¿Cómo pagar?</strong> Visita la tienda física con el número de
                      pedido <strong>#{pedido.id_venta}</strong> y cancela en caja. Aceptamos
                      efectivo, tarjeta o transferencia.
                    </div>
                  )}

                  <div style={styles.cardFooter}>
                    Pedido realizado el{" "}
                    {new Date(pedido.fecha_venta).toLocaleDateString("es-GT", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background: "linear-gradient(165deg, #fff9f0 0%, #f5e6d3 45%, #e8dcc8 100%)",
    fontFamily: "sans-serif",
    color: "#2c2418",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.25rem 2rem",
    borderBottom: "1px solid rgba(74,55,40,0.12)",
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(8px)",
    flexWrap: "wrap",
    gap: "1rem",
  },
  logo: { fontWeight: 800, fontSize: "1.5rem", color: "#c45c26", margin: 0 },
  tag: { margin: "0.15rem 0 0", fontSize: "0.88rem", color: "#6b5b4b" },
  main: { maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" },
  lista: { display: "flex", flexDirection: "column", gap: "1.5rem" },
  card: {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 28px rgba(44,36,24,0.08)",
    border: "1px solid rgba(74,55,40,0.08)",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid rgba(74,55,40,0.08)",
  },
  pedidoId: { fontWeight: 700, fontSize: "1.05rem", marginRight: "0.75rem" },
  badge: {
    display: "inline-block",
    fontSize: "0.78rem",
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
  },
  total: { fontWeight: 800, fontSize: "1.4rem", color: "#2d6a4f" },
  fechaLimite: {
    margin: "0 1.5rem",
    padding: "0.65rem 1rem",
    borderRadius: 10,
    border: "1px solid",
    fontSize: "0.88rem",
    fontWeight: 500,
    marginTop: "1rem",
  },
  tabla: { width: "100%", borderCollapse: "collapse", marginTop: "1rem" },
  th: {
    padding: "0.5rem 1.5rem",
    fontSize: "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#8a6d4d",
    borderBottom: "1px solid rgba(74,55,40,0.1)",
    textAlign: "left",
  },
  td: {
    padding: "0.75rem 1.5rem",
    borderBottom: "1px solid rgba(74,55,40,0.06)",
    fontSize: "0.9rem",
  },
  infoPago: {
    margin: "1rem 1.5rem",
    padding: "0.75rem 1rem",
    background: "#f0faf4",
    borderRadius: 10,
    fontSize: "0.85rem",
    color: "#0f5132",
    border: "1px solid #a3cfbb",
  },
  cardFooter: {
    padding: "0.75rem 1.5rem",
    fontSize: "0.8rem",
    color: "#8a6d4d",
    borderTop: "1px solid rgba(74,55,40,0.06)",
  },
  vacio: {
    textAlign: "center",
    padding: "4rem 2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  },
  alerta: {
    padding: "0.8rem 1rem",
    background: "#fdecea",
    border: "1px solid #f5c2c7",
    borderRadius: 10,
    color: "#842029",
    marginBottom: "1rem",
  },
  center: { padding: "4rem", textAlign: "center", color: "#6b5b4b" },
  btnPrimary: {
    background: "linear-gradient(135deg, #c45c26, #e8742e)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "0.7rem 1.5rem",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.95rem",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid rgba(74,55,40,0.25)",
    borderRadius: 8,
    padding: "0.45rem 0.9rem",
    cursor: "pointer",
    color: "#4a3728",
    fontSize: "0.9rem",
  },
};