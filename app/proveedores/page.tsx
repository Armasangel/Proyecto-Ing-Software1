"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

type Proveedor = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string | null;
  telefono: string | null;
  estado_proveedor: boolean;
};

const formVacio = {
  nombre_proveedor: "",
  nit_proveedor: "",
  correo_contacto: "",
  telefono: "",
};

export default function ProveedoresPage() {
  const usuario = useStaffSession();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const res = await fetch("/api/proveedores");
    const data = await res.json();
    setProveedores(data.proveedores || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  if (usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={usuario} title="Gestión de Proveedores" subtitle="">
        <p style={{ color: "var(--muted)" }}>No tenés permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  async function guardar() {
    const res = await fetch("/api/proveedores", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id_proveedor: editando }),
    });
    if (res.ok) {
      setMensaje(editando ? "Proveedor actualizado." : "Proveedor creado.");
      setEditando(null);
      setCreando(false);
      setForm(formVacio);
      cargar();
    } else {
      setMensaje("Error al guardar.");
    }
  }

  async function desactivar(id_proveedor: number) {
    if (!confirm("¿Desactivar este proveedor?")) return;
    const res = await fetch("/api/proveedores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_proveedor }),
    });
    if (res.ok) {
      setMensaje("Proveedor desactivado.");
      cargar();
    }
  }

  function iniciarEdicion(p: Proveedor) {
    setEditando(p.id_proveedor);
    setCreando(false);
    setForm({
      nombre_proveedor: p.nombre_proveedor,
      nit_proveedor: p.nit_proveedor,
      correo_contacto: p.correo_contacto || "",
      telefono: p.telefono || "",
    });
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.3rem 0.6rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    width: "100%",
    background: "var(--background)",
    color: "var(--foreground)",
  };

  return (
    <StaffShell
      usuario={usuario}
      title="Gestión de Proveedores"
      subtitle="Administrá los proveedores de la tienda"
    >
      {mensaje && (
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>
          {mensaje}
        </p>
      )}

      {!creando && !editando && (
        <button
          onClick={() => {
            setCreando(true);
            setForm(formVacio);
            setMensaje("");
          }}
          style={{
            marginBottom: "1.5rem",
            padding: "0.5rem 1.2rem",
            borderRadius: 6,
            background: "#52b788",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Nuevo proveedor
        </button>
      )}

      {(creando || editando) && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: 8,
            maxWidth: 480,
          }}
        >
          <h3 style={{ marginBottom: "1rem" }}>
            {editando ? "Editar proveedor" : "Nuevo proveedor"}
          </h3>
          {(
            [
              { label: "Nombre *", key: "nombre_proveedor" },
              { label: "NIT *", key: "nit_proveedor" },
              { label: "Correo", key: "correo_contacto" },
              { label: "Teléfono", key: "telefono" },
            ] as { label: string; key: keyof typeof formVacio }[]
          ).map(({ label, key }) => (
            <div key={key} style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                {label}
              </label>
              <input
                style={inputStyle}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <button
              onClick={guardar}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: 6,
                background: "#52b788",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setCreando(false);
              }}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: 6,
                background: "var(--border)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.75rem" }}>Nombre</th>
              <th style={{ padding: "0.75rem" }}>NIT</th>
              <th style={{ padding: "0.75rem" }}>Correo</th>
              <th style={{ padding: "0.75rem" }}>Teléfono</th>
              <th style={{ padding: "0.75rem" }}>Estado</th>
              <th style={{ padding: "0.75rem" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id_proveedor} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem" }}>{p.nombre_proveedor}</td>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>{p.nit_proveedor}</td>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                  {p.correo_contacto || "—"}
                </td>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                  {p.telefono || "—"}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <span
                    style={{
                      color: p.estado_proveedor ? "#52b788" : "#e63946",
                      fontWeight: 600,
                    }}
                  >
                    {p.estado_proveedor ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ padding: "0.75rem", display: "flex", gap: 8 }}>
                  <button
                    onClick={() => iniciarEdicion(p)}
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: 6,
                      background: "#91a7ff",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Editar
                  </button>
                  {p.estado_proveedor && (
                    <button
                      onClick={() => desactivar(p.id_proveedor)}
                      style={{
                        padding: "0.3rem 0.8rem",
                        borderRadius: 6,
                        background: "#e63946",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}