"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

type ProductoDeuda = {
  id_producto: number;
  nombre_producto: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

type Deuda = {
  id_deuda: number;
  nombre_deudor: string;
  telefono_deudor: string | null;
  fecha_inicio: string;
  monto_total: string;
  estado_deuda: "PENDIENTE" | "PAGADA";
  productos: ProductoDeuda[];
};

type Producto = {
  id_producto: number;
  nombre_producto: string;
  precio_unitario: string;
  unidad_medida: string;
};

type LineaForm = { id_producto: string; cantidad: string };

const formVacio = {
  nombre_deudor: "",
  telefono_deudor: "",
  fecha_inicio: new Date().toISOString().slice(0, 10),
};

export default function DeudasPage() {
  const usuario = useStaffSession();
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [lineas, setLineas] = useState<LineaForm[]>([{ id_producto: "", cantidad: "1" }]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cambiandoId, setCambiandoId] = useState<number | null>(null);

  async function cargarDeudas() {
    const res = await fetch("/api/deudas");
    const data = await res.json();
    setDeudas(data.deudas || []);
  }

  async function cargarProductos() {
    const res = await fetch("/api/productos");
    const data = await res.json();
    setProductos((data.productos || []).filter((p: any) => p.estado_producto));
  }

  useEffect(() => {
    cargarDeudas();
    cargarProductos();
  }, []);

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  if (usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={usuario} title="Deudas" subtitle="">
        <p style={{ color: "var(--muted)" }}>No tenés permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.3rem 0.6rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    width: "100%",
    background: "var(--background)",
    color: "var(--foreground)",
  };

  function agregarLinea() {
    setLineas([...lineas, { id_producto: "", cantidad: "1" }]);
  }

  function quitarLinea(idx: number) {
    setLineas(lineas.filter((_, i) => i !== idx));
  }

  function actualizarLinea(idx: number, campo: keyof LineaForm, valor: string) {
    setLineas(lineas.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function totalPreview(): number {
    return lineas.reduce((acc, l) => {
      const prod = productos.find((p) => String(p.id_producto) === l.id_producto);
      const cantidad = Number(l.cantidad) || 0;
      if (!prod) return acc;
      return acc + Number(prod.precio_unitario) * cantidad;
    }, 0);
  }

  async function crearDeuda() {
    setError("");
    const productosPayload = lineas
      .filter((l) => l.id_producto && Number(l.cantidad) > 0)
      .map((l) => ({ id_producto: Number(l.id_producto), cantidad: Number(l.cantidad) }));

    const res = await fetch("/api/deudas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, productos: productosPayload }),
    });

    if (res.ok) {
      setMensaje("Deuda creada.");
      setCreando(false);
      setForm(formVacio);
      setLineas([{ id_producto: "", cantidad: "1" }]);
      cargarDeudas();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al crear la deuda.");
    }
  }

  // botonCambioEstado — DEV-81
  async function cambiarEstado(id_deuda: number) {
    setCambiandoId(id_deuda);
    const res = await fetch(`/api/deudas/${id_deuda}`, { method: "PATCH" });
    if (res.ok) {
      cargarDeudas();
    } else {
      setError("No se pudo cambiar el estado de la deuda.");
    }
    setCambiandoId(null);
  }

  return (
    <StaffShell
      usuario={usuario}
      title="Deudas"
      subtitle="Registrá y llevá el control de las deudas pendientes"
    >
      {mensaje && (
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>{mensaje}</p>
      )}
      {error && (
        <p style={{ color: "#e63946", marginBottom: "1rem", fontWeight: 600 }}>{error}</p>
      )}

      {!creando && (
        <button
          onClick={() => {
            setCreando(true);
            setMensaje("");
            setError("");
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
          + Nueva deuda
        </button>
      )}

      {creando && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: 8,
            maxWidth: 600,
          }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Nueva deuda</h3>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
              ¿Quién debe? *
            </label>
            <input
              style={inputStyle}
              value={form.nombre_deudor}
              onChange={(e) => setForm({ ...form, nombre_deudor: e.target.value })}
              placeholder="Nombre de la persona"
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                Teléfono (opcional)
              </label>
              <input
                style={inputStyle}
                value={form.telefono_deudor}
                onChange={(e) => setForm({ ...form, telefono_deudor: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                Fecha de inicio
              </label>
              <input
                type="date"
                style={inputStyle}
                value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              />
            </div>
          </div>

          <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
            Productos *
          </label>
          {lineas.map((linea, idx) => (
            <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <select
                style={inputStyle}
                value={linea.id_producto}
                onChange={(e) => actualizarLinea(idx, "id_producto", e.target.value)}
              >
                <option value="">Seleccioná un producto…</option>
                {productos.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.nombre_producto} (Q{Number(p.precio_unitario).toFixed(2)}/{p.unidad_medida})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0.001}
                step="0.001"
                style={{ ...inputStyle, width: 100 }}
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)}
              />
              {lineas.length > 1 && (
                <button
                  onClick={() => quitarLinea(idx)}
                  style={{
                    padding: "0 0.6rem",
                    borderRadius: 6,
                    background: "var(--border)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={agregarLinea}
            style={{
              marginTop: "0.25rem",
              marginBottom: "1rem",
              padding: "0.3rem 0.8rem",
              borderRadius: 6,
              background: "transparent",
              border: "1px dashed var(--border)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            + Agregar producto
          </button>

          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>
            Total: Q{totalPreview().toFixed(2)}
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={crearDeuda}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: 6,
                background: "#52b788",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Guardar deuda
            </button>
            <button
              onClick={() => setCreando(false)}
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
              <th style={{ padding: "0.75rem" }}>Persona</th>
              <th style={{ padding: "0.75rem" }}>Productos</th>
              <th style={{ padding: "0.75rem" }}>Monto</th>
              <th style={{ padding: "0.75rem" }}>Fecha inicio</th>
              <th style={{ padding: "0.75rem" }}>Estado</th>
              <th style={{ padding: "0.75rem" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {deudas.map((d) => (
              <tr key={d.id_deuda} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem" }}>
                  {d.nombre_deudor}
                  {d.telefono_deudor && (
                    <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                      {d.telefono_deudor}
                    </div>
                  )}
                </td>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                  {d.productos.map((p) => `${p.nombre_producto} x${p.cantidad}`).join(", ")}
                </td>
                <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                  Q{Number(d.monto_total).toFixed(2)}
                </td>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                  {new Date(d.fecha_inicio).toLocaleDateString("es-GT")}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <span
                    style={{
                      color: d.estado_deuda === "PAGADA" ? "#52b788" : "#e63946",
                      fontWeight: 600,
                    }}
                  >
                    {d.estado_deuda === "PAGADA" ? "Pagada" : "Pendiente"}
                  </span>
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <button
                    onClick={() => cambiarEstado(d.id_deuda)}
                    disabled={cambiandoId === d.id_deuda}
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: 6,
                      background: d.estado_deuda === "PAGADA" ? "#e63946" : "#52b788",
                      color: "#fff",
                      border: "none",
                      cursor: cambiandoId === d.id_deuda ? "default" : "pointer",
                      opacity: cambiandoId === d.id_deuda ? 0.6 : 1,
                    }}
                  >
                    {cambiandoId === d.id_deuda
                      ? "Guardando…"
                      : d.estado_deuda === "PAGADA"
                      ? "Marcar pendiente"
                      : "Marcar pagada"}
                  </button>
                </td>
              </tr>
            ))}
            {deudas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)" }}>
                  No hay deudas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
