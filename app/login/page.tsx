"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
  }

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        maxWidth: 400,
        margin: "4rem auto",
        padding: "2rem",
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h1 style={{ color: "#1a6b3a", marginBottom: "1.5rem" }}>🏪 Tienda San Miguel</h1>
      <h2 style={{ marginBottom: "1rem" }}>Iniciar sesión</h2>
      <form onSubmit={handleLogin}>
        <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
          Usuario
        </label>
        <input
          type="text"
          name="username"
          autoComplete="username"
          placeholder="Correo registrado"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "1rem",
            boxSizing: "border-box",
          }}
        />
        <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
          Contraseña
        </label>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "1rem",
            boxSizing: "border-box",
          }}
        />
        {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "0.75rem",
            background: "#1a6b3a",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
