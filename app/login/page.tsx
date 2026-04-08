"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, contrasena }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error al iniciar sesión");
      return;
    }
    router.push("/inventario");
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 400, margin: "4rem auto", padding: "2rem", border: "1px solid #ddd", borderRadius: 8 }}>
      <h1 style={{ color: "#1a6b3a", marginBottom: "1.5rem" }}>🏪 Tienda San Miguel</h1>
      <h2 style={{ marginBottom: "1rem" }}>Iniciar sesión</h2>
      <input
        type="email"
        placeholder="Correo"
        value={correo}
        onChange={e => setCorreo(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem", boxSizing: "border-box" }}
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={contrasena}
        onChange={e => setContrasena(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem", boxSizing: "border-box" }}
      />
      {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}
      <button
        onClick={handleLogin}
        style={{ width: "100%", padding: "0.75rem", background: "#1a6b3a", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
      >
        Entrar
      </button>
    </main>
  );
}
