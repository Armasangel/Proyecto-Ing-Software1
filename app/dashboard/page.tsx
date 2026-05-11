"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { isDuenoTipo } from "@/lib/roles";

export default function DashboardPage() {
  const usuario = useStaffSession();
  const [stats, setStats] = useState({
    productos: 0,
    ventas: 0,
    pendientes: 0,
    proveedores: 0,
  });

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => d.stats && setStats(d.stats))
      .catch(() => {});
  }, [usuario]);

  if (!usuario) {
    return (
      <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>
    );
  }

  const quickActions = useMemo(() => {
    const dueno = isDuenoTipo(usuario.tipo_usuario);
    const base = [
      { href: "/productos", icon: "🌿", label: "Productos" },
      { href: "/ventas", icon: "🧾", label: "Ventas" },
      { href: "/reportes", icon: "📊", label: "Reportes" },
    ];

    if (dueno) {
      return [
        { href: "/gestion-inventario", icon: "🏭", label: "Gestión inventario" },
        { href: "/inventario", icon: "📦", label: "Inventario" },
        { href: "/inventario/entrada", icon: "⬇", label: "Entrada stock" },
        ...base,
      ];
    }

    return base;
  }, [usuario.tipo_usuario]);

  return (
    <StaffShell
      usuario={usuario}
      title="Dashboard"
      subtitle={`Hola, ${usuario.nombre.split(" ")[0]} — ${new Date().toLocaleDateString("es-GT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}`}
    >
      <div style={s.statsGrid}>
        {[
          {
            label: "Productos activos",
            value: stats.productos,
            icon: "🌿",
            color: "var(--green)",
          },
          {
            label: "Ventas registradas",
            value: stats.ventas,
            icon: "🧾",
            color: "var(--blue)",
          },
          {
            label: "Ventas pendientes",
            value: stats.pendientes,
            icon: "⏳",
            color: "var(--accent)",
          },
          {
            label: "Proveedores",
            value: stats.proveedores,
            icon: "🚚",
            color: "var(--muted)",
          },
        ].map((stat) => (
          <div key={stat.label} style={s.statCard}>
            <div style={{ ...s.statIcon, background: stat.color + "22" }}>
              <span style={{ fontSize: "1.3rem" }}>{stat.icon}</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontFamily: "var(--font-head)",
                  fontWeight: 700,
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  marginTop: "0.1rem",
                }}
              >
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <h2 style={s.sectionTitle}>Acciones rápidas</h2>
        <div style={s.actionsGrid}>
          {quickActions.map((item) => (
            <Link key={item.href} href={item.href} style={s.actionCard}>
              <span style={{ fontSize: "1.8rem" }}>{item.icon}</span>
              <span style={{ fontWeight: 500, color: "var(--text)" }}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--muted)",
    marginBottom: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "0.75rem",
  },
  actionCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.25rem 1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    textDecoration: "none",
    transition: "border-color .15s, background .15s",
  },
};
