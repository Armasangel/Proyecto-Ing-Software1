"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { labelRol, staffVariantFromTipo } from "@/lib/roles";

export type StaffUsuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

const NAV = [
  { href: "/dashboard", icon: "◈", label: "Dashboard" },
  { href: "/inventario", icon: "📦", label: "Inventario" },
  { href: "/inventario/entrada", icon: "⬇", label: "Entrada stock" },
  { href: "/productos", icon: "🌿", label: "Productos" },
  { href: "/ventas", icon: "🧾", label: "Ventas" },
  { href: "/precios", icon: "💲", label: "Precios" },
  { href: "/facturacion", icon: "🧮", label: "Facturación" },
  { href: "/reportes", icon: "📊", label: "Reportes" },
];

const NAV_HREFS = NAV.map((n) => n.href);

/** Activa un ítem solo si coincide la ruta; si hay un enlace más específico en el nav (ej. /inventario/entrada), no resalta el padre. */
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

const THEMES = {
  dueno: {
    accent: "#2d6a4f",
    accentSoft: "rgba(45, 106, 79, 0.35)",
    logoTint: "#52b788",
    sidebarWash: "linear-gradient(180deg, rgba(45,106,79,0.12) 0%, transparent 55%)",
  },
  colaborador: {
    accent: "#4c6ef5",
    accentSoft: "rgba(76, 110, 245, 0.35)",
    logoTint: "#91a7ff",
    sidebarWash: "linear-gradient(180deg, rgba(76,110,245,0.12) 0%, transparent 55%)",
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

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div style={s.shell}>
      <aside
        style={{
          ...s.sidebar,
          backgroundImage: t.sidebarWash,
        }}
      >
        <div style={s.sidebarTop}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <div style={s.sidebarLogo}>
              <span>🏪</span>
              <span style={{ ...s.sidebarLogoText, color: t.logoTint }}>Tienda San Miguel</span>
            </div>
          </Link>
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--muted)",
              marginTop: "-1rem",
              marginBottom: "1.25rem",
              paddingLeft: "0.15rem",
            }}
          >
            {variant === "dueno" ? "Panel del dueño" : "Panel del colaborador"}
          </div>
          <nav style={s.nav}>
            {NAV.map((item) => {
              const active = isStaffNavActive(pathname, item.href, NAV_HREFS);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...s.navLink,
                    ...(active
                      ? {
                          background: t.accentSoft,
                          color: t.logoTint,
                          fontWeight: 500,
                        }
                      : {}),
                  }}
                >
                  <span style={s.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={s.sidebarBottom}>
          <div style={s.userBadge}>
            <div
              style={{
                ...s.userAvatar,
                background: t.accent,
                color: "#fff",
              }}
            >
              {usuario.nombre[0]}
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              >
                {usuario.nombre}
              </div>
              <div style={{ fontSize: "0.72rem", color: t.logoTint }}>
                {labelRol(usuario.tipo_usuario)}
              </div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} style={s.logoutBtn}>
            ← Salir
          </button>
        </div>
      </aside>

      <main style={s.main}>
        <div style={s.topbar}>
          <div>
            <h1 style={{ ...s.pageTitle, color: t.logoTint }}>{title}</h1>
            {subtitle && (
              <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{subtitle}</p>
            )}
          </div>
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
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    backgroundColor: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    height: "100vh",
  },
  sidebarTop: { padding: "1.5rem 1rem" },
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "2rem",
  },
  sidebarLogoText: {
    fontFamily: "var(--font-head)",
    fontSize: "1.05rem",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  nav: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.55rem 0.75rem",
    borderRadius: 8,
    color: "var(--muted)",
    fontSize: "0.88rem",
    fontWeight: 400,
    textDecoration: "none",
    transition: "background .15s, color .15s",
  },
  navIcon: { fontSize: "1rem", width: 20, textAlign: "center" },
  sidebarBottom: { padding: "1rem", borderTop: "1px solid var(--border)" },
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginBottom: "0.8rem",
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-head)",
    fontSize: "0.9rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  logoutBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--muted)",
    padding: "0.45rem 0.75rem",
    fontSize: "0.82rem",
    cursor: "pointer",
    textAlign: "left",
  },
  main: { flex: 1, padding: "2rem", overflowY: "auto" },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "2rem",
    gap: "1rem",
  },
  pageTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.6rem",
    fontWeight: 700,
    marginBottom: "0.2rem",
  },
};
