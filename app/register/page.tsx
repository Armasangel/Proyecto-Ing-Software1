"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", correo: "", telefono: "", contrasena: "", confirmar: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.contrasena !== form.confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.contrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          correo: form.correo,
          telefono: form.telefono,
          contrasena: form.contrasena,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear la cuenta");
        return;
      }
      router.push("/tienda");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={s.page}>
      <div style={s.formCard}>
        <div style={s.header}>
          <Link href="/login" style={{ color: "var(--muted)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "1.5rem" }}>
            ← Volver al inicio de sesión
          </Link>
          <div style={s.logo}>
            <span>🌱</span>
            <span style={s.logoText}>AgroStock</span>
          </div>
          <h1 style={s.title}>Crear cuenta</h1>
          <p style={s.sub}>Regístrate como comprador para realizar pedidos</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <Field label="Nombre completo" name="nombre" type="text" placeholder="Pedro Ajú García" value={form.nombre} onChange={handleChange} required />
          <Field label="Correo electrónico" name="correo" type="email" placeholder="pedro@gmail.com" value={form.correo} onChange={handleChange} required />
          <Field label="Teléfono (opcional)" name="telefono" type="tel" placeholder="5555-1234" value={form.telefono} onChange={handleChange} />
          <Field label="Contraseña" name="contrasena" type="password" placeholder="Mínimo 6 caracteres" value={form.contrasena} onChange={handleChange} required />
          <Field label="Confirmar contraseña" name="confirmar" type="password" placeholder="Repite tu contraseña" value={form.confirmar} onChange={handleChange} required />

          {error && (
            <div style={s.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p style={s.switchLink}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, name, type, placeholder, value, onChange, required }: {
  label: string; name: string; type: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <label style={s.label}>{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={s.input}
        onFocus={e => Object.assign(e.target.style, { borderColor: "var(--accent)", boxShadow: "0 0 0 3px rgba(232,160,69,.15)" })}
        onBlur={e => Object.assign(e.target.style, { borderColor: "var(--border)", boxShadow: "none" })}
      />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: "var(--bg)",
    fontFamily: "var(--font-body)",
  },
  formCard: {
    width: "100%",
    maxWidth: 460,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "2.5rem",
    boxShadow: "var(--shadow)",
  },
  header: { marginBottom: "1.5rem" },
  logo: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" },
  logoText: { fontFamily: "var(--font-head)", fontSize: "1.4rem", fontWeight: 800, color: "var(--accent)" },
  title: { fontFamily: "var(--font-head)", fontSize: "1.6rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.3rem" },
  sub: { color: "var(--muted)", fontSize: "0.88rem" },
  form: { display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.2rem" },
  label: { fontSize: "0.82rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.02em" },
  input: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.7rem 0.9rem",
    color: "var(--text)",
    fontSize: "0.92rem",
    outline: "none",
    width: "100%",
    transition: "border-color .2s, box-shadow .2s",
  },
  errorBox: {
    background: "rgba(248,81,73,.12)",
    border: "1px solid rgba(248,81,73,.3)",
    borderRadius: "var(--radius)",
    padding: "0.7rem 1rem",
    color: "var(--red)",
    fontSize: "0.85rem",
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
    letterSpacing: "0.02em",
    marginTop: "0.3rem",
  },
  switchLink: { textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" },
};
