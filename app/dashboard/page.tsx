"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { isDuenoTipo } from "@/lib/roles";

export default function DashboardPage() {
  // ── Todos los hooks PRIMERO, sin ningún return antes ──
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

  const quickActions = useMemo(() => {
    if (!usuario) return [];
    const dueno = isDuenoTipo(usuario.tipo_usuario);
    const base = [
      { href: "/productos", icon: "🌿", label: "Productos", desc: "Ver catálogo" },
      { href: "/ventas", icon: "🧾", label: "Ventas", desc: "Registrar venta" },
      { href: "/reportes", icon: "📊", label: "Reportes", desc: "Ver métricas" },
    ];
    if (dueno) {
      return [
        { href: "/gestion-inventario", icon: "🏭", label: "Gestión inventario", desc: "Stock y kardex" },
        { href: "/inventario", icon: "📦", label: "Inventario", desc: "Alta de productos" },
        { href: "/inventario/entrada", icon: "⬇", label: "Entrada stock", desc: "Ingresar mercadería" },
        ...base,
      ];
    }
    return base;
  }, [usuario]);

  // ── Early return DESPUÉS de todos los hooks ──
  if (!usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;
  }

  const statCards = [
    {
      label: "Productos activos",
      value: stats.productos,
      icon: "🌿",
      colorVar: "var(--sky)",
      bgVar: "rgba(152,171,238,0.12)",
    },
    {
      label: "Ventas registradas",
      value: stats.ventas,
      icon: "🧾",
      colorVar: "#7C8FFF",
      bgVar: "rgba(124,143,255,0.12)",
    },
    {
      label: "Ventas pendientes",
      value: stats.pendientes,
      icon: "⏳",
      colorVar: "var(--accent)",
      bgVar: "rgba(249,232,201,0.12)",
    },
    {
      label: "Proveedores",
      value: stats.proveedores,
      icon: "🚚",
      colorVar: "var(--green)",
      bgVar: "rgba(82,199,136,0.12)",
    },
  ];

  const fecha = new Date().toLocaleDateString("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const nombreCorto = usuario.nombre.split(" ")[0];

  return (
    <StaffShell
      usuario={usuario}
      title="Dashboard"
      subtitle={`Hola, ${nombreCorto} — ${fecha}`}
    >
      {/* ── Banner de notificación ── */}
      {stats.pendientes > 0 && (
        <div style={s.notifBanner}>
          <div style={s.notifDot} />
          <span style={s.notifText}>
            Tienes{" "}
            <strong style={{ color: "var(--accent)" }}>{stats.pendientes}</strong>{" "}
            venta{stats.pendientes !== 1 ? "s" : ""} pendiente
            {stats.pendientes !== 1 ? "s" : ""}
          </span>
          <Link href="/ventas" style={s.notifLink}>
            Ver detalles →
          </Link>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={s.statsGrid}>
        {statCards.map((stat) => (
          <div key={stat.label} style={s.statCard}>
            <div style={{ ...s.statIconWrap, background: stat.bgVar }}>
              <span style={{ fontSize: "1.25rem" }}>{stat.icon}</span>
            </div>
            <div style={s.statInfo}>
              <div style={{ ...s.statValue, color: stat.colorVar }}>
                {stat.value}
              </div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
            <div style={{ ...s.statBar, background: stat.colorVar }} />
          </div>
        ))}
      </div>

      {/* ── Acciones rápidas ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Acciones rápidas</h2>
        <div style={s.actionsGrid}>
          {quickActions.map((item) => (
            <Link key={item.href} href={item.href} style={s.actionCard}>
              <span style={s.actionIcon}>{item.icon}</span>
              <div>
                <div style={s.actionLabel}>{item.label}</div>
                <div style={s.actionDesc}>{item.desc}</div>
              </div>
              <span style={s.actionArrow}>→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Estado del sistema ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Estado del sistema</h2>
        <div style={s.summaryGrid}>
          <div style={s.summaryCard}>
            <div style={s.summaryHeader}>
              <span style={dotStyle(stats.productos > 0, "var(--green)")} />
              <span style={s.summaryTitle}>Catálogo</span>
            </div>
            <p style={s.summaryBody}>
              {stats.productos > 0
                ? `${stats.productos} productos activos disponibles en el sistema.`
                : "No hay productos activos registrados."}
            </p>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryHeader}>
              <span style={dotStyle(stats.pendientes === 0, "var(--amber)")} />
              <span style={s.summaryTitle}>Ventas pendientes</span>
            </div>
            <p style={s.summaryBody}>
              {stats.pendientes === 0
                ? "Sin ventas pendientes. Todo al día."
                : `Hay ${stats.pendientes} venta${stats.pendientes !== 1 ? "s" : ""} esperando confirmación.`}
            </p>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryHeader}>
              <span style={dotStyle(true, "var(--sky)")} />
              <span style={s.summaryTitle}>Proveedores</span>
            </div>
            <p style={s.summaryBody}>
              {stats.proveedores} proveedor
              {stats.proveedores !== 1 ? "es" : ""} activo
              {stats.proveedores !== 1 ? "s" : ""} registrado
              {stats.proveedores !== 1 ? "s" : ""}.
            </p>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

// ── Helper fuera del componente ──
function dotStyle(ok: boolean, colorOk: string): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    background: ok ? colorOk : "var(--amber)",
    boxShadow: `0 0 6px ${ok ? colorOk : "var(--amber)"}`,
  };
}

// ── Estilos ──
const s: Record<string, React.CSSProperties> = {
  notifBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    background: "rgba(249,232,201,0.08)",
    border: "1px solid rgba(249,232,201,0.22)",
    borderRadius: "var(--radius)",
    padding: "0.75rem 1.25rem",
    marginBottom: "1.75rem",
    flexWrap: "wrap",
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    flexShrink: 0,
    boxShadow: "0 0 8px var(--accent)",
  },
  notifText: {
    fontSize: "0.9rem",
    color: "var(--muted)",
    flex: 1,
  },
  notifLink: {
    fontSize: "0.82rem",
    color: "var(--accent)",
    fontWeight: 600,
    letterSpacing: "0.02em",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "1.25rem 1.25rem 0",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    overflow: "hidden",
    position: "relative",
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statInfo: {
    flex: 1,
    paddingBottom: "1.25rem",
  },
  statValue: {
    fontSize: "2rem",
    fontFamily: "var(--font-head)",
    fontWeight: 700,
    lineHeight: 1.1,
    marginBottom: "0.2rem",
  },
  statLabel: {
    fontSize: "0.78rem",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 500,
  },
  statBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.5,
  },
  section: {
    marginBottom: "2rem",
  },
  sectionTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--muted)",
    marginBottom: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderLeft: "3px solid var(--sky)",
    paddingLeft: "0.65rem",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "0.75rem",
  },
  actionCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    textDecoration: "none",
    cursor: "pointer",
  },
  actionIcon: {
    fontSize: "1.4rem",
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface2)",
    borderRadius: 10,
    flexShrink: 0,
  },
  actionLabel: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "0.1rem",
  },
  actionDesc: {
    fontSize: "0.75rem",
    color: "var(--muted)",
  },
  actionArrow: {
    marginLeft: "auto",
    color: "var(--sky)",
    fontSize: "1rem",
    opacity: 0.6,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "0.75rem",
  },
  summaryCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.1rem 1.25rem",
  },
  summaryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  summaryTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "0.88rem",
    fontWeight: 700,
    color: "var(--text)",
  },
  summaryBody: {
    fontSize: "0.82rem",
    color: "var(--muted)",
    lineHeight: 1.6,
  },
};