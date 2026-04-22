"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

type Producto = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: number;
  precio_mayoreo: number;
  unidad_medida: string;
  nombre_categoria: string;
};

export default function PreciosPage() {
  const usuario = useStaffSession();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState({ precio_unitario: "", precio_mayoreo: "" });
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/api/precios")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []));
  }, []);

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const esDueno = usuario.tipo_usuario === "DUENO";

  async function guardar(id_producto: number) {
    const res = await fetch("/api/precios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_producto,
        precio_unitario: parseFloat(form.precio_unitario),
        precio_mayoreo: parseFloat(form.precio_mayoreo),
      }),
    });
    if (res.ok) {
      setMensaje("Precio actualizado correctamente");
      setEditando(null);
      const data = await fetch("/api/precios").then((r) => r.json());
      setProductos(data.productos || []);
    } else {
      setMensaje("Error al actualizar");
    }
  }

  return (
    <StaffShell usuario={usuario} title="Gestión de Precios" subtitle="Consultá y editá los precios de los productos">
      {mensaje && (
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>{mensaje}</p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.75rem" }}>Código</th>
              <th style={{ padding: "0.75rem" }}>Producto</th>
              <th style={{ padding: "0.75rem" }}>Categoría</th>
              <th style={{ padding: "0.75rem" }}>Precio unitario</th>
              <th style={{ padding: "0.75rem" }}>Precio mayoreo</th>
              {esDueno && <th style={{ padding: "0.75rem" }}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id_producto} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>{p.codigo_producto}</td>
                <td style={{ padding: "0.75rem" }}>{p.nombre_producto}</td>
                <td style={{ padding: "0.75rem", color: "var(--muted)" }}>{p.nombre_categoria}</td>
                <td style={{ padding: "0.75rem" }}>
                  {editando === p.id_producto ? (
                    <input
                      type="number"
                      value={form.precio_unitario}
                      onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
                      style={{ width: 90, padding: "0.3rem", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  ) : (
                    `Q${Number(p.precio_unitario).toFixed(2)}`
                  )}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  {editando === p.id_producto ? (
                    <input
                      type="number"
                      value={form.precio_mayoreo}
                      onChange={(e) => setForm({ ...form, precio_mayoreo: e.target.value })}
                      style={{ width: 90, padding: "0.3rem", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  ) : (
                    `Q${Number(p.precio_mayoreo).toFixed(2)}`
                  )}
                </td>
                {esDueno && (
                  <td style={{ padding: "0.75rem" }}>
                    {editando === p.id_producto ? (
                      <>
                        <button onClick={() => guardar(p.id_producto)} style={{ marginRight: 8, padding: "0.3rem 0.8rem", borderRadius: 6, background: "#52b788", color: "#fff", border: "none", cursor: "pointer" }}>
                          Guardar
                        </button>
                        <button onClick={() => setEditando(null)} style={{ padding: "0.3rem 0.8rem", borderRadius: 6, background: "var(--border)", border: "none", cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditando(p.id_producto);
                          setForm({ precio_unitario: String(p.precio_unitario), precio_mayoreo: String(p.precio_mayoreo) });
                        }}
                        style={{ padding: "0.3rem 0.8rem", borderRadius: 6, background: "#91a7ff", color: "#fff", border: "none", cursor: "pointer" }}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}