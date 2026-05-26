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
  { href: "/dashboard",        icon: "◈",  label: "Dashboard" },
  { href: "/inventario",       icon: "📦", label: "Inventario" },
  { href: "/catalogo",         icon: "🌿", label: "Catálogo" },
  { href: "/ventas",           icon: "🧾", label: "Ventas" },
  { href: "/facturacion",      icon: "🧮", label: "Facturación" },
  { href: "/reportes",         icon: "📊", label: "Reportes" },
  { href: "/proveedores",      icon: "🚚", label: "Proveedores" },
  { href: "/historial-ventas", icon: "📋", label: "Historial ventas" },
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

// Ambos roles comparten la misma paleta azul/crema
// Solo difieren en el color de acento del badge de rol
const THEMES = {
  dueno: {
    rolBadge: "#F9E8C9",
    rolBadgeBg: "rgba(249, 232, 201, 0.18)",
    rolColor: "#F9E8C9",
    avatarBg: "#1D24CA",
    pageAccent: "#1D24CA",
    pageAccentLight: "#98ABEE",
  },
  colaborador: {
    rolBadge: "#98ABEE",
    rolBadgeBg: "rgba(152, 171, 238, 0.18)",
    rolColor: "#98ABEE",
    avatarBg: "#98ABEE",
    pageAccent: "#1D24CA",
    pageAccentLight: "#98ABEE",
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
    if (["/inventario", "/catalogo", "/historial-ventas", "/proveedores"].includes(item.href)) {
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
            <div style={s.sidebarLogo}>
              <span style={s.logoEmoji}>🏪</span>
              <div>
                <div style={s.logoTitle}>Tienda</div>
                <div style={s.logoSub}>San Miguel</div>
              </div>
            </div>
          </Link>

          {/* Role badge */}
          <div style={{ ...s.rolBadge, color: t.rolColor }}>
            {variant === "dueno" ? "👑 Panel del Dueño" : "🛒 Colaborador"}
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
                    ...(active ? s.navLinkActive : {}),
                  }}
                >
                  <span style={s.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                  {active && <span style={s.navActiveDot} />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User section */}
        <div style={s.sidebarBottom}>
          <div style={s.userCard}>
            <div style={{ ...s.userAvatar, background: t.avatarBg }}>
              {usuario.nombre[0].toUpperCase()}
            </div>
            <div style={s.userInfo}>
              <div style={s.userName}>{usuario.nombre.split(" ")[0]}</div>
              <div style={{ ...s.userRole, color: t.rolColor }}>
                {labelRol(usuario.tipo_usuario)}
              </div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} style={s.logoutBtn}>
            ← Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={s.main}>
        {/* Top bar */}
        <div style={s.topbar}>
          <div>
            <h1 style={{ ...s.pageTitle, color: t.pageAccent }}>{title}</h1>
            {subtitle && (
              <p style={s.pageSubtitle}>{subtitle}</p>
            )}
          </div>
          {/* Decorative accent bar */}
          <div style={{ ...s.accentBar, background: `linear-gradient(90deg, ${t.pageAccent}, ${t.pageAccentLight})` }} />
        </div>
        {children}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "var(--font-body)",
    background: "var(--bg)",
  },

  /* ── Sidebar ── */
  sidebar: {
    width: 230,
    flexShrink: 0,
    background: "#201658",           /* marino profundo */
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    height: "100vh",
    boxShadow: "4px 0 24px rgba(32, 22, 88, 0.25)",
  },

  sidebarTop: {
    padding: "1.5rem 1rem 1rem",
  },

  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    marginBottom: "1.25rem",
    padding: "0.5rem 0.5rem",
    borderRadius: 10,
    background: "rgba(152, 171, 238, 0.1)",
    border: "1px solid rgba(152, 171, 238, 0.15)",
  },

  logoEmoji: {
    fontSize: "1.6rem",
    lineHeight: 1,
  },

  logoTitle: {
    fontFamily: "var(--font-head)",
    fontWeight: 800,
    fontSize: "1rem",
    color: "#F9E8C9",
    lineHeight: 1.1,
  },

  logoSub: {
    fontFamily: "var(--font-head)",
    fontWeight: 600,
    fontSize: "0.72rem",
    color: "#98ABEE",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  rolBadge: {
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "#98ABEE",
    marginBottom: "1.25rem",
    paddingLeft: "0.25rem",
    letterSpacing: "0.02em",
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
    padding: "0.6rem 0.75rem",
    borderRadius: 8,
    color: "#98ABEE",
    fontSize: "0.87rem",
    fontWeight: 400,
    textDecoration: "none",
    transition: "background .15s, color .15s",
    position: "relative",
  },

  navLinkActive: {
    background: "rgba(152, 171, 238, 0.2)",
    color: "#F9E8C9",
    fontWeight: 600,
  },

  navActiveDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#F9E8C9",
    marginLeft: "auto",
    flexShrink: 0,
  },

  navIcon: {
    fontSize: "1rem",
    width: 20,
    textAlign: "center",
    flexShrink: 0,
  },

  /* ── Sidebar bottom ── */
  sidebarBottom: {
    padding: "1rem",
    borderTop: "1px solid rgba(152, 171, 238, 0.2)",
  },

  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    marginBottom: "0.75rem",
    padding: "0.5rem",
    borderRadius: 8,
    background: "rgba(152, 171, 238, 0.08)",
  },

  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-head)",
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#201658",
    flexShrink: 0,
  },

  userInfo: {
    minWidth: 0,
  },

  userName: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#F9E8C9",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userRole: {
    fontSize: "0.7rem",
    color: "#98ABEE",
    marginTop: "0.05rem",
  },

  logoutBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(152, 171, 238, 0.3)",
    borderRadius: 8,
    color: "#98ABEE",
    padding: "0.45rem 0.75rem",
    fontSize: "0.82rem",
    cursor: "pointer",
    textAlign: "left",
    transition: "background .15s",
  },

  /* ── Main ── */
  main: {
    flex: 1,
    padding: "2rem",
    overflowY: "auto",
    background: "var(--bg)",
  },

  topbar: {
    marginBottom: "2rem",
    position: "relative",
  },

  pageTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.7rem",
    fontWeight: 800,
    marginBottom: "0.2rem",
    color: "#201658",
  },

  pageSubtitle: {
    color: "var(--muted)",
    fontSize: "0.88rem",
  },

  accentBar: {
    position: "absolute",
    top: "50%",
    right: 0,
    width: 60,
    height: 3,
    borderRadius: 99,
    transform: "translateY(-50%)",
    opacity: 0.4,
  },
};