"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{
    id_usuario: number
    nombre: string
    correo: string
    tipo_usuario: string
  } | null>(null);

  useEffect(() => {
    fetch("/api/sesion")
      .then(r => r.json())
      .then(d => {
        if (!d.usuario) {
          router.replace("/login");
          return;
        }
        setUsuario(d.usuario);
      });
  }, [router]);

  if (!usuario) {
    return <p style={{ padding: "2rem", fontFamily: "sans-serif" }}>Cargando…</p>;
  }

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        padding: "2rem",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <h1 style={{ color: "#1a6b3a" }}>Panel principal</h1>
      <p style={{ color: "#444", marginTop: "0.5rem" }}>
        Página plantilla. Aquí irá el tablero cuando lo definan.
      </p>
      <hr style={{ margin: "1.5rem 0" }} />
      <p>
        <strong>Sesión:</strong> {usuario.nombre} ({usuario.tipo_usuario}) — {usuario.correo}
      </p>
    </main>
  );
}
