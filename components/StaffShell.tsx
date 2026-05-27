"use client";

/* Shell principal para dueño y colaborador.
   Incluye sidebar fijo, topbar con título y slot de contenido. */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isColaboradorTipo, isDuenoTipo, labelRol, staffVariantFromTipo } from "@/lib/roles";
import { Icon, type IconName } from "@/components/Icon";

export type StaffUsuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

/* Mapa de rutas a iconos */
const NAV: NavItem[] = [
  { href: "/dashboard",        label: "Dashboard",       icon: "dashboard"     },
  { href: "/inventario",       label: "Inventario",      icon: "inventory"     },
  { href: "/catalogo",         label: "Catálogo",        icon: "catalogue"     },
  { href: "/ventas",           label: "Ventas",          icon: "shopping-cart" },
  { href: "/facturacion",      label: "Facturación",     icon: "bill"          },
  { href: "/reportes",         label: "Reportes",        icon: "report"        },
  { href: "/proveedores",      label: "Proveedores",     icon: "hand-truck"    },
  { href: "/historial-ventas", label: "Historial ventas",icon: "distribution"  },
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

const THEMES = {
  dueno: {
    rolColor: "#F9E8C9",
    avatarBg: "#1D24CA",
    pageAccent: "#1D24CA",
    /* Icono de rol en sidebar */
    rolIcon: "owner" as IconName,
  },
  colaborador: {
    rolColor: "#98ABEE",
    avatarBg: "#98ABEE",
    pageAccent: "#1D24CA",
    rolIcon: "seller" as IconName,
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
  const [modoClaro, setModoClaro] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem("tema");
    if (guardado === "light") {
      setModoClaro(true);
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  function toggleTema() {
    const nuevoModo = !modoClaro;
    setModoClaro(nuevoModo);
    if (nuevoModo) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("tema", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("tema", "dark");
    }
  }

  const navVisible = NAV.filter((item) => {
    if (item.href === "/ventas") return isColaboradorTipo(usuario.tipo_usuario);
    if (
      item.href === "/gestion-inventario" ||
      item.href === "/inventario" ||
      item.href === "/inventario/entrada" ||
      item.href === "/bodegas" ||
      item.href === "/historial-ventas"
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
      <aside style={{ ...s.sidebar, backgroundImage: t.sidebarWash }}>
        <div style={s.sidebarTop}>

          {/* Logo */}
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <div style={s.sidebarLogo}>
              <div>
                <div style={s.logoTitle}>Tienda</div>
                <div style={s.logoSub}>San Miguel</div>
              </div>
            </div>
          </Link>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "-1rem", marginBottom: "1.25rem", paddingLeft: "0.15rem" }}>
            {variant === "dueno" ? "Panel del dueño" : "Panel del colaborador"}
          </div>

          {/* Navegación */}
          <nav style={s.nav}>
            {navVisible.map((item) => {
              const active = isStaffNavActive(pathname, item.href, navHrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...s.navLink,
                    ...(active ? { background: t.accentSoft, color: t.logoTint, fontWeight: 500 } : {}),
                  }}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    variant="light"
                    /* Reduce opacidad en links inactivos para no competir con el label */
                  />
                  <span style={{ opacity: active ? 1 : 0.75 }}>{item.label}</span>
                  {active && <span style={s.navActiveDot} />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Usuario y logout */}
        <div style={s.sidebarBottom}>
          <div style={s.userBadge}>
            <div style={{ ...s.userAvatar, background: t.accent, color: "#fff" }}>
              {usuario.nombre[0]}
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text)" }}>
                {usuario.nombre}
              </div>
              <div style={{ fontSize: "0.72rem", color: t.logoTint }}>
                {labelRol(usuario.tipo_usuario)}
              </div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} style={s.logoutBtn}>
            <Icon name="lockout" size={14} variant="light" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={s.main}>
        <div style={s.topbar}>
          <div>
            <h1 style={{ ...s.pageTitle, color: t.logoTint }}>{title}</h1>
            {subtitle && (
              <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={toggleTema}
            title={modoClaro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.45rem 0.75rem",
              cursor: "pointer",
              fontSize: "1.1rem",
              color: "var(--text)",
              flexShrink: 0,
            }}
          >
            {modoClaro ? "🌙" : "☀️"}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}

/* ─── Estilos ─────────────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", fontFamily: "var(--font-body)" },
  sidebar: {
    width: 230,
    flexShrink: 0,
    background: "#150f3a",           /* más oscuro que --accent2 para más contraste */
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    height: "100vh",
    boxShadow: "4px 0 20px rgba(0, 0, 0, 0.3)",
  },
  sidebarTop: { padding: "1.5rem 1rem" },
  sidebarLogo: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" },
  sidebarLogoText: { fontFamily: "var(--font-head)", fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.2 },
  nav: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    padding: "0.55rem 0.75rem",
    borderRadius: 8,
    color: "var(--accent-light)",
    fontSize: "0.85rem",
    fontWeight: 400,
    textDecoration: "none",
    transition: "background .15s",
  },
  sidebarBottom: { padding: "1rem", borderTop: "1px solid var(--border)" },
  userBadge: { display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.8rem" },
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
    color: "#150f3a",
    flexShrink: 0,
  },

  userInfo: {
    minWidth: 0,
  },

  userName: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--bg)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userRole: {
    fontSize: "0.7rem",
    marginTop: "0.05rem",
  },

  /* Botón de logout */
  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "transparent",
    border: "1px solid rgba(152, 171, 238, 0.2)",
    borderRadius: 8,
    color: "rgba(152, 171, 238, 0.7)",
    padding: "0.45rem 0.75rem",
    fontSize: "0.82rem",
    cursor: "pointer",
    textAlign: "left",
    transition: "background .15s, color .15s",
  },

  /* Área de contenido */
  main: {
    flex: 1,
    padding: "2rem",
    overflowY: "auto",
    background: "var(--bg)",
  },

  /* Topbar de página */
  topbar: {
    marginBottom: "2rem",
  },
  pageTitle: { fontFamily: "var(--font-head)", fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.2rem" },
};