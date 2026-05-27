"use client";

/* Página de login.
   Panel izquierdo: branding con fondo sólido oscuro, texto ordenado en bloque único.
   Panel derecho: formulario limpio sobre fondo blanco. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postLoginPath } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }
      const dest =
        data.usuario?.tipo_usuario != null
          ? postLoginPath(data.usuario.tipo_usuario)
          : "/dashboard";
      router.push(dest);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={s.page}>

      {/* ── Panel izquierdo: branding ─────────────────────────────────────── */}
      <div style={s.brand}>
        <div style={s.brandContent}>

          {/* Nombre del sistema */}
          <div style={s.brandHeader}>
            <p style={s.brandEyebrow}>Sistema de gestión</p>
            <h1 style={s.brandTitle}>Tienda San Miguel</h1>
          </div>

          {/* Descripción y features en bloque compacto */}
          <div style={s.brandBody}>
            <p style={s.brandDesc}>
              Plataforma de inventario y ventas para mayoristas de Guatemala.
            </p>
            <ul style={s.featureList}>
              {[
                "Control de inventario en tiempo real",
                "Ventas mayoristas y minoristas",
                "Kardex y trazabilidad",
                "Reportes y facturación",
              ].map((f) => (
                <li key={f} style={s.featureItem}>
                  <span style={s.featureDot} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* ── Panel derecho: formulario ─────────────────────────────────────── */}
      <div style={s.formPanel}>
        <div style={s.formCard}>

          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Bienvenido de vuelta</h2>
            <p style={s.formSub}>Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleLogin} style={s.form}>

            {/* Correo */}
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="usuario@tienda.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={s.input}
              />
            </div>

            {/* Contraseña */}
            <div style={s.field}>
              <label style={s.label}>Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={s.input}
              />
            </div>

            {error && (
              <div style={s.errorBox}>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Ingresando…" : "Ingresar al sistema"}
            </button>
          </form>

          <p style={s.switchLink}>
            ¿No tienes cuenta?{" "}
            <Link href="/register" style={s.switchLinkAnchor}>
              Regístrate aquí
            </Link>
          </p>

          {/* Usuarios de prueba */}
          <div style={s.demo}>
            <p style={s.demoLabel}>Usuarios de prueba (password123):</p>
            <div style={s.demoBtns}>
              {[
                { label: "Dueño",           correo: "dueno@tienda.com"    },
                { label: "Colaborador",     correo: "empleado@tienda.com" },
                { label: "Comprador",       correo: "maria@gmail.com"     },
                { label: "Comprador mayor", correo: "pedro@gmail.com"     },
              ].map((u) => (
                <button
                  key={u.correo}
                  type="button"
                  onClick={() => setUsername(u.correo)}
                  style={s.demoBtn}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

/* ─── Estilos ─────────────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  /* Layout de dos columnas */
  page: {
    minHeight: "100vh",
    display: "flex",
    fontFamily: "var(--font-body)",
  },

  /* ── Panel izquierdo ── */

  /* Fondo sólido oscuro, sin gradientes raros */
  brand: {
    flex: "0 0 42%",
    background: "#150f3a",
    display: "flex",
    alignItems: "center",
    padding: "3rem",
  },

  /* Bloque de contenido alineado como unidad */
  brandContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
    maxWidth: 340,
  },

  brandHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },

  /* "Sistema de gestión" pequeño arriba del título */
  brandEyebrow: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "var(--accent-light)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: 0,
  },

  brandTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "2.2rem",
    fontWeight: 800,
    color: "var(--bg)",
    lineHeight: 1.15,
    margin: 0,
  },

  brandBody: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },

  brandDesc: {
    fontSize: "0.92rem",
    color: "rgba(152, 171, 238, 0.8)",
    lineHeight: 1.65,
    margin: 0,
  },

  /* Lista de features compacta, sin "niveles" extraños */
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },

  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    fontSize: "0.88rem",
    color: "rgba(249, 232, 201, 0.75)",
  },

  featureDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--accent-light)",
    flexShrink: 0,
  },

  /* ── Panel derecho ── */

  formPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: "#ffffff",
  },

  formCard: {
    width: "100%",
    maxWidth: 420,
  },

  formHeader: {
    marginBottom: "2rem",
  },

  formTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: "0.4rem",
  },

  formSub: {
    color: "var(--muted)",
    fontSize: "0.9rem",
    margin: 0,
  },

  /* Formulario */
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
    marginBottom: "1.25rem",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },

  label: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "var(--muted)",
  },

  input: {
    background: "#ffffff",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.75rem 1rem",
    color: "var(--text)",
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    transition: "border-color .2s, box-shadow .2s",
  },

  /* El hover/focus del botón no afecta otros elementos porque
     box-shadow y transform están aplicados solo al <button> */
  btn: {
    background: "var(--accent)",
    color: "var(--bg)",                /* crema, no negro */
    border: "none",
    borderRadius: "var(--radius)",
    padding: "0.85rem",
    fontFamily: "var(--font-head)",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    transition: "box-shadow .2s, transform .15s",
  },

  errorBox: {
    background: "rgba(192, 57, 43, 0.08)",
    border: "1px solid rgba(192, 57, 43, 0.25)",
    borderRadius: "var(--radius)",
    padding: "0.75rem 1rem",
    color: "var(--red)",
    fontSize: "0.88rem",
  },

  switchLink: {
    textAlign: "center",
    color: "var(--muted)",
    fontSize: "0.88rem",
    marginBottom: "1.25rem",
    margin: "0 0 1.25rem",
  },

  switchLinkAnchor: {
    color: "var(--accent)",
    fontWeight: 500,
    textDecoration: "none",
  },

  /* Bloque de usuarios de prueba */
  demo: {
    marginTop: "1.25rem",
    padding: "1rem",
    background: "var(--surface2)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
  },

  demoLabel: {
    color: "var(--muted)",
    fontSize: "0.78rem",
    marginBottom: "0.5rem",
    margin: "0 0 0.5rem",
  },

  demoBtns: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },

  demoBtn: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.7rem",
    color: "var(--text)",
    fontSize: "0.78rem",
    cursor: "pointer",
  },
};