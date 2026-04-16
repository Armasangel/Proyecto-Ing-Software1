"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Usuario = { id_usuario: number; nombre: string; correo: string; tipo_usuario: string };

const NAV = [
  { href: "/dashboard",          icon: "◈", label: "Dashboard"    },
  { href: "/inventario",         icon: "📦", label: "Inventario"   },
  { href: "/inventario/entrada", icon: "⬇", label: "Entrada stock" },
  { href: "/productos",          icon: "🌿", label: "Productos"    },
  { href: "/ventas",             icon: "🧾", label: "Ventas"       },
  { href: "/reportes",           icon: "📊", label: "Reportes"     },
];

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [stats, setStats] = useState({ productos: 0, ventas: 0, pendientes: 0, proveedores: 0 });

  useEffect(() => {
    fetch("/api/sesion")
      .then(r => r.json())
      .then(d => {
        if (!d.usuario) { router.replace("/login"); return; }
        setUsuario(d.usuario);
      });

    fetch("/api/stats")
      .then(r => r.json())
      .then(d => d.stats && setStats(d.stats))
      .catch(() => {});
  }, [router]);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!usuario) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;

  const rolColor: Record<string, string> = {
    DUENO: "var(--accent)",
    EMPLEADO: "var(--blue)",
    COMPRADOR: "var(--green)",
  };

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.sidebarLogo}>
            <span>🌱</span>
            <span style={s.sidebarLogoText}>AgroStock</span>
          </div>
          <nav style={s.nav}>
            {NAV.map(item => (
              <Link key={item.href} href={item.href} style={s.navLink}>
                <span style={s.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div style={s.sidebarBottom}>
          <div style={s.userBadge}>
            <div style={s.userAvatar}>{usuario.nombre[0]}</div>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text)" }}>{usuario.nombre}</div>
              <div style={{ fontSize: "0.72rem", color: rolColor[usuario.tipo_usuario] ?? "var(--muted)" }}>
                {usuario.tipo_usuario}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>← Salir</button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <div style={s.topbar}>
          <div>
            <h1 style={s.pageTitle}>Dashboard</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
              Hola, {usuario.nombre.split(" ")[0]} — {new Date().toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsGrid}>
          {[
            { label: "Productos activos",  value: stats.productos,   icon: "🌿", color: "var(--green)"  },
            { label: "Ventas registradas", value: stats.ventas,      icon: "🧾", color: "var(--blue)"   },
            { label: "Ventas pendientes",  value: stats.pendientes,  icon: "⏳", color: "var(--accent)" },
            { label: "Proveedores",        value: stats.proveedores, icon: "🚚", color: "var(--muted)"  },
          ].map(stat => (
            <div key={stat.label} style={s.statCard}>
              <div style={{ ...s.statIcon, background: stat.color + "22" }}>
                <span style={{ fontSize: "1.3rem" }}>{stat.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)", fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.1rem" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Acciones rápidas</h2>
          <div style={s.actionsGrid}>
            {NAV.slice(1).map(item => (
              <Link key={item.href} href={item.href} style={s.actionCard}>
                <span style={{ fontSize: "1.8rem" }}>{item.icon}</span>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", fontFamily: "var(--font-body)" },
  sidebar: {
    width: 220, flexShrink: 0,
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column",
    justifyContent: "space-between",
    position: "sticky", top: 0, height: "100vh",
  },
  sidebarTop: { padding: "1.5rem 1rem" },
  sidebarLogo: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" },
  sidebarLogoText: { fontFamily: "var(--font-head)", fontSize: "1.2rem", fontWeight: 800, color: "var(--accent)" },
  nav: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  navLink: {
    display: "flex", alignItems: "center", gap: "0.6rem",
    padding: "0.55rem 0.75rem", borderRadius: 8,
    color: "var(--muted)", fontSize: "0.88rem", fontWeight: 400,
    textDecoration: "none",
    transition: "background .15s, color .15s",
  },
  navIcon: { fontSize: "1rem", width: 20, textAlign: "center" },
  sidebarBottom: { padding: "1rem", borderTop: "1px solid var(--border)" },
  userBadge: { display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.8rem" },
  userAvatar: {
    width: 32, height: 32, borderRadius: "50%",
    background: "var(--accent)", color: "#0d1117",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-head)", fontSize: "0.9rem", fontWeight: 700,
    flexShrink: 0,
  },
  logoutBtn: {
    width: "100%", background: "transparent",
    border: "1px solid var(--border)", borderRadius: 8,
    color: "var(--muted)", padding: "0.45rem 0.75rem",
    fontSize: "0.82rem", cursor: "pointer", textAlign: "left",
  },
  main: { flex: 1, padding: "2rem", overflowY: "auto" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" },
  pageTitle: { fontFamily: "var(--font-head)", fontSize: "1.6rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.2rem" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" },
  statCard: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 12, padding: "1.25rem",
    display: "flex", alignItems: "center", gap: "1rem",
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" },
  section: { marginBottom: "2rem" },
  sectionTitle: { fontFamily: "var(--font-head)", fontSize: "1rem", fontWeight: 700, color: "var(--muted)", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" },
  actionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" },
  actionCard: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 12, padding: "1.25rem 1rem",
    display: "flex", flexDirection: "column", gap: "0.5rem",
    textDecoration: "none", transition: "border-color .15s, background .15s",
  },
};
