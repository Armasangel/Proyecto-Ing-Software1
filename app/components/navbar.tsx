"use client";
// app/components/Navbar.tsx
// Barra de navegación compartida para todas las páginas protegidas

import { useRouter } from "next/navigation";
import Link from "next/link";

interface NavbarProps {
  usuario: {
    nombre: string;
    correo: string;
    tipo_usuario: string;
  };
}

const ROL_COLOR: Record<string, string> = {
  DUENO: "#e8a045",
  EMPLEADO: "#58a6ff",
  COMPRADOR: "#3fb950",
};

const ROL_LABEL: Record<string, string> = {
  DUENO: "Dueño",
  EMPLEADO: "Empleado",
  COMPRADOR: "Comprador",
};

export default function Navbar({ usuario }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  const rolColor = ROL_COLOR[usuario.tipo_usuario] || "#8b949e";
  const esDuenoOEmpleado =
    usuario.tipo_usuario === "DUENO" || usuario.tipo_usuario === "EMPLEADO";

  return (
    <nav style={s.nav}>
      <div style={s.inner}>
        {/* Logo */}
        <Link href="/dashboard" style={s.logo}>
          <span style={s.logoIcon}>🏪</span>
          <span style={s.logoText}>Tienda San Miguel</span>
        </Link>

        {/* Links de navegación según rol */}
        <div style={s.links}>
          <Link href="/dashboard" style={s.link}>
            Panel
          </Link>
          <Link href="/inventario" style={s.link}>
            Inventario
          </Link>
          {esDuenoOEmpleado && (
            <Link href="/inventario/entrada" style={s.link}>
              Entrada de Stock
            </Link>
          )}
        </div>

        {/* Info usuario + logout */}
        <div style={s.userArea}>
          <div style={s.userInfo}>
            <span style={s.userName}>{usuario.nombre}</span>
            <span
              style={{
                ...s.rolBadge,
                background: rolColor + "22",
                color: rolColor,
                border: `1px solid ${rolColor}44`,
              }}
            >
              {ROL_LABEL[usuario.tipo_usuario] || usuario.tipo_usuario}
            </span>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav: {
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  inner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 1.5rem",
    height: 56,
    display: "flex",
    alignItems: "center",
    gap: "2rem",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    textDecoration: "none",
    flexShrink: 0,
  },
  logoIcon: { fontSize: "1.4rem" },
  logoText: {
    fontFamily: "var(--font-head)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--accent)",
  },
  links: {
    display: "flex",
    gap: "0.25rem",
    flex: 1,
  },
  link: {
    color: "var(--muted)",
    textDecoration: "none",
    fontSize: "0.88rem",
    padding: "0.35rem 0.75rem",
    borderRadius: 6,
    transition: "background .15s, color .15s",
  },
  userArea: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexShrink: 0,
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.1rem",
  },
  userName: {
    fontSize: "0.85rem",
    color: "var(--text)",
    fontWeight: 500,
  },
  rolBadge: {
    fontSize: "0.7rem",
    padding: "0.1rem 0.5rem",
    borderRadius: 99,
    fontWeight: 600,
    letterSpacing: "0.04em",
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--muted)",
    fontSize: "0.82rem",
    padding: "0.35rem 0.75rem",
    cursor: "pointer",
  },
};