"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      router.push("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={s.page}>
      {/* Panel izquierdo — branding */}
      <div style={s.brand}>
        <div style={s.brandInner}>
          <div style={s.logo}>
            <span style={s.logoIcon}>🏪</span>
            <span style={s.logoText}>Tienda San Miguel</span>
          </div>
          <p style={s.tagline}>
            Sistema de gestión de inventario y ventas para distribuidoras mayoristas de Guatemala.
          </p>
          <div style={s.features}>
            {[
              "Control de inventario en tiempo real",
              "Ventas mayoristas y minoristas",
              "Kardex y trazabilidad",
              "Reportes y facturación",
            ].map((f) => (
              <div key={f} style={s.feature}>
                <span style={s.featureDot} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={s.brandBg} />
      </div>

      {/* Panel derecho — formulario */}
      <div style={s.formPanel}>
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h1 style={s.formTitle}>Bienvenido de vuelta</h1>
            <p style={s.formSub}>Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleLogin} style={s.form}>
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
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) =>
                  Object.assign(e.target.style, {
                    borderColor: "var(--border)",
                    boxShadow: "none",
                  })
                }
              />
            </div>

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
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) =>
                  Object.assign(e.target.style, {
                    borderColor: "var(--border)",
                    boxShadow: "none",
                  })
                }
              />
            </div>

            {error && (
              <div style={s.errorBox}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
              onMouseEnter={(e) =>
                !loading &&
                Object.assign((e.target as HTMLElement).style, s.btnHover)
              }
              onMouseLeave={(e) =>
                Object.assign((e.target as HTMLElement).style, {
                  background: "var(--accent)",
                  transform: "none",
                })
              }
            >
              {loading ? "Ingresando…" : "Ingresar al sistema"}
            </button>
          </form>

          {/* Demo users — emails now match the DB seed data */}
          <div style={s.demo}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginBottom: "0.4rem" }}>
              Usuarios de prueba (contraseña: <strong style={{ color: "var(--text)" }}>password123</strong>):
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { label: "Dueño", correo: "dueno@tienda.com" },
                { label: "Empleado", correo: "empleado@tienda.com" },
                { label: "Comprador", correo: "maria@gmail.com" },
              ].map((u) => (
                <button
                  key={u.correo}
                  onClick={() => setUsername(u.correo)}
                  style={s.demoBtn}
                  title={u.correo}
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

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    fontFamily: "var(--font-body)",
  },
  brand: {
    position: "relative",
    flex: "0 0 42%",
    background: "linear-gradient(145deg, #0d2b0f 0%, #0d1117 60%, #1a1200 100%)",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
  },
  brandBg: {
    position: "absolute",
    inset: 0,
    backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(232,160,69,.12) 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, rgba(63,185,80,.08) 0%, transparent 50%)`,
    pointerEvents: "none",
  },
  brandInner: {
    position: "relative",
    zIndex: 1,
    padding: "3rem",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "2rem",
  },
  logoIcon: { fontSize: "2.2rem" },
  logoText: {
    fontFamily: "var(--font-head)",
    fontSize: "1.7rem",
    fontWeight: 800,
    color: "var(--accent)",
    letterSpacing: "-0.5px",
  },
  tagline: {
    color: "var(--muted)",
    fontSize: "1rem",
    lineHeight: 1.7,
    maxWidth: 320,
    marginBottom: "2.5rem",
  },
  features: { display: "flex", flexDirection: "column", gap: "0.9rem" },
  feature: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    color: "var(--text)",
    fontSize: "0.9rem",
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    flexShrink: 0,
  },
  formPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: "var(--bg)",
  },
  formCard: {
    width: "100%",
    maxWidth: 420,
  },
  formHeader: { marginBottom: "2rem" },
  formTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: "0.4rem",
  },
  formSub: { color: "var(--muted)", fontSize: "0.9rem" },
  form: { display: "flex", flexDirection: "column", gap: "1.2rem", marginBottom: "1.5rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "var(--muted)",
    letterSpacing: "0.02em",
  },
  input: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.75rem 1rem",
    color: "var(--text)",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color .2s, box-shadow .2s",
    width: "100%",
  },
  inputFocus: {
    borderColor: "var(--accent)",
    boxShadow: "0 0 0 3px rgba(232,160,69,.15)",
  },
  errorBox: {
    background: "rgba(248,81,73,.12)",
    border: "1px solid rgba(248,81,73,.3)",
    borderRadius: "var(--radius)",
    padding: "0.75rem 1rem",
    color: "var(--red)",
    fontSize: "0.88rem",
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  btn: {
    background: "var(--accent)",
    color: "#0d1117",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "0.85rem",
    fontFamily: "var(--font-head)",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform .15s, background .15s",
    letterSpacing: "0.02em",
  },
  btnHover: { background: "var(--accent2)", transform: "translateY(-1px)" },
  demo: {
    marginTop: "1rem",
    padding: "1rem",
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
  },
  demoBtn: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.7rem",
    color: "var(--text)",
    fontSize: "0.78rem",
    cursor: "pointer",
  },
};