"use client";

import Link from "next/link";
import { formatQuetzales } from "@/components/cobranza/format";
import { useDeudoresResumen } from "@/hooks/useCobranza";

export function CobranzaResumenCards() {
  const { data, isLoading } = useDeudoresResumen();

  if (isLoading) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Cargando cobranza…
      </p>
    );
  }

  const r = data?.resumen;
  if (!r) return null;

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2 style={sectionTitle}>Cobranza</h2>
        <Link href="/cobranza" style={linkStyle}>
          Ver deudas →
        </Link>
      </div>

      <div style={statsGrid}>
        <div style={statCard}>
          <div style={{ ...statIcon, background: "rgba(45,106,79,0.15)" }}>
            <span style={{ fontSize: "1.3rem" }}>💰</span>
          </div>
          <div>
            <div style={{ ...statValue, color: "#52b788" }}>
              Q{formatQuetzales(r.total_adeudado)}
            </div>
            <div style={statLabel}>Total adeudado</div>
          </div>
        </div>

        <div style={statCard}>
          <div style={{ ...statIcon, background: "rgba(76,110,245,0.15)" }}>
            <span style={{ fontSize: "1.3rem" }}>📋</span>
          </div>
          <div>
            <div style={{ ...statValue, color: "var(--blue)" }}>
              {r.deudas_activas}
            </div>
            <div style={statLabel}>Deudas activas</div>
          </div>
        </div>

        <div style={statCard}>
          <div style={{ ...statIcon, background: "rgba(220,53,69,0.15)" }}>
            <span style={{ fontSize: "1.3rem" }}>⚠</span>
          </div>
          <div>
            <div style={{ ...statValue, color: "#ff6b6b" }}>
              {r.deudas_criticas}
            </div>
            <div style={statLabel}>Deudas críticas</div>
          </div>
        </div>
      </div>

      {data.por_cliente.length > 0 && (
        <div style={clientBox}>
          <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Mayor deuda por cliente
          </div>
          {data.por_cliente.slice(0, 3).map((c) => (
            <div
              key={c.id_usuario}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.85rem",
                padding: "0.25rem 0",
              }}
            >
              <span>{c.nombre_cliente}</span>
              <span style={{ fontWeight: 600 }}>
                Q{formatQuetzales(c.total_adeudado)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-head)",
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: 0,
};

const linkStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#52b788",
  textDecoration: "none",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: "1rem",
};

const statCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.25rem",
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const statIcon: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const statValue: React.CSSProperties = {
  fontSize: "1.5rem",
  fontFamily: "var(--font-head)",
  fontWeight: 700,
};

const statLabel: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--muted)",
  marginTop: "0.1rem",
};

const clientBox: React.CSSProperties = {
  marginTop: "1rem",
  padding: "0.85rem 1rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  maxWidth: 420,
};
