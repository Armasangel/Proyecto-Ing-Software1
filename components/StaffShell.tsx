"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isColaboradorTipo, isDuenoTipo, labelRol, staffVariantFromTipo } from "@/lib/roles";

export type StaffUsuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

const NAV = [
  { href: "/dashboard", icon: "◈", label: "Dashboard" },
  { href: "/gestion-inventario", icon: "🏭", label: "Gestión inventario" },
  { href: "/bodegas", icon: "🏗", label: "Bodegas" },
  { href: "/inventario", icon: "📦", label: "Inventario" },
  { href: "/inventario/entrada", icon: "⬇", label: "Entrada stock" },
  { href: "/productos", icon: "🌿", label: "Productos" },
  { href: "/ventas", icon: "🧾", label: "Ventas" },
  { href: "/precios", icon: "💲", label: "Precios" },
  { href: "/facturacion", icon: "🧮", label: "Facturación" },
  { href: "/reportes", icon: "📊", label: "Reportes" },
  { href: "/proveedores", icon: "🏭", label: "Proveedores" },
];

function isStaffNavActive(
  pathname: string,
  href: string,
  allHrefs: readonly string[]
): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
}

/* ── Temas por rol ── */
const THEMES = {
  dueno: {
    accent:     "#F9E8C9",        /* crema */
    accentText: "#201658",
    highlight:  "rgba(249,232,201,0.12)",
    highlightBorder: "rgba(249,232,201,0.25)",
    avatarBg:   "#F9E8C9",
    avatarText: "#201658",
    roleLabel:  "#F9E8C9",
    badge:      "Dueño",
  },
  colaborador: {
    accent:     "#98ABEE",        /* sky blue */
    accentText: "#0F0E2E",
    highlight:  "rgba(152,171,238,0.12)",
    highlightBorder: "rgba(152,171,238,0.25)",
    avatarBg:   "#98ABEE",
    avatarText: "#201658",
    roleLabel:  "#98ABEE",
    badge:      "Colaborador",
  },
} as const;

type Props = {
  usuario: StaffUsuario;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function StaffShell({ usuario, title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const variant = staffVariantFromTipo(usuario.tipo_usuario);
  const t = THEMES[variant];

  const navVisible = NAV.filter((item) => {
    if (item.href === "/ventas") return isColaboradorTipo(usuario.tipo_usuario);
    if (
      item.href === "/gestion-inventario" ||
      item.href === "/inventario" ||
      item.href === "/inventario/entrada" ||
      item.href === "/bodegas"
    ) {
      return isDuenoTipo(usuario.tipo_usuario);
    }
    return true;
  });
  const navHrefs = navVisible.map((n) => n.href);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div style={s.shell}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.sidebarTop}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <div style={s.logoWrap}>
              <div style={s.logoIcon}>🏪</div>
              <div>
                <div style={s.logoText}>Tienda</div>
                <div style={s.logoSub}>San Miguel</div>
              </div>
            </div>
          </Link>

          {/* Role badge */}
          <div
            style={{
              ...s.roleBadge,
              background: t.highlight,
              border: `1px solid ${t.highlightBorder}`,
              color: t.accent,
            }}
          >
            {t.badge}
          </div>

          {/* Nav */}
          <nav style={s.nav}>
            {navVisible.map((item) => {
              const active = isStaffNavActive(pathname, item.href, navHrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...s.navLink,
                    ...(active
                      ? {
                          background: t.highlight,
                          borderLeft: `3px solid ${t.accent}`,
                          color: t.accent,
                          paddingLeft: "calc(0.75rem - 3px)",
                          fontWeight: 600,
                        }
                      : {
                          borderLeft: "3px solid transparent",
                          paddingLeft: "calc(0.75rem - 3px)",
                        }),
                  }}
                >
                  <span style={s.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User footer */}
        <div style={s.sidebarBottom}>
          <div style={s.userRow}>
            <div
              style={{
                ...s.userAvatar,
                background: t.avatarBg,
                color: t.avatarText,
              }}
            >
              {usuario.nombre[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={s.userName}>{usuario.nombre}</div>
              <div style={{ ...s.userRole, color: t.roleLabel }}>
                {labelRol(usuario.tipo_usuario)}
              </div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} style={s.logoutBtn}>
            Salir
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div>
            <h1 style={{ ...s.pageTitle, color: t.accent }}>{title}</h1>
            {subtitle && <p style={s.pageSubtitle}>{subtitle}</p>}
          </div>
        </div>
        <div style={s.content}>{children}</div>
      </main>
    </div>
  );
}

/* ── Estilos ── */
const s: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "var(--font-body)",
    background: "var(--bg)",
  },

  /* Sidebar */
  sidebar: {
    width: 230,
    flexShrink: 0,
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflow: "hidden",
  },
  sidebarTop: {
    padding: "1.5rem 1rem 1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    flex: 1,
    overflowY: "auto",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    marginBottom: "0.25rem",
  },
  logoIcon: {
    fontSize: "1.5rem",
    width: 38,
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(249,232,201,0.12)",
    borderRadius: 10,
    border: "1px solid rgba(249,232,201,0.2)",
  },
  logoText: {
    fontFamily: "var(--font-head)",
    fontSize: "1rem",
    fontWeight: 800,
    color: "var(--text)",
    lineHeight: 1.1,
  },
  logoSub: {
    fontFamily: "var(--font-head)",
    fontSize: "0.72rem",
    color: "var(--muted)",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  roleBadge: {
    padding: "0.3rem 0.7rem",
    borderRadius: 999,
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    alignSelf: "flex-start",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.55rem 0.75rem",
    borderRadius: "0 8px 8px 0",
    color: "var(--muted)",
    fontSize: "0.85rem",
    fontWeight: 400,
    textDecoration: "none",
    transition: "background .15s, color .15s",
    marginRight: "0.5rem",
  },
  navIcon: {
    fontSize: "1rem",
    width: 20,
    textAlign: "center",
    flexShrink: 0,
  },

  /* Sidebar bottom */
  sidebarBottom: {
    padding: "0.85rem 1rem",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    background: "rgba(0,0,0,0.15)",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-head)",
    fontSize: "0.88rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: {
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  userRole: {
    fontSize: "0.7rem",
    fontWeight: 500,
  },
  logoutBtn: {
    background: "rgba(152,171,238,0.08)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--muted)",
    padding: "0.4rem 0.75rem",
    fontSize: "0.78rem",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition: "background .15s",
  },

  /* Main */
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    minWidth: 0,
  },
  topbar: {
    padding: "1.75rem 2rem 0",
    marginBottom: "0.25rem",
  },
  pageTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.7rem",
    fontWeight: 800,
    marginBottom: "0.2rem",
    letterSpacing: "-0.01em",
  },
  pageSubtitle: {
    fontSize: "0.85rem",
    color: "var(--muted)",
    marginBottom: "1.5rem",
  },
  content: {
    padding: "0 2rem 2.5rem",
  },
};