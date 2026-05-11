"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";

interface Producto {
  id_producto: number;
  nombre_producto: string;
  codigo_producto: string;
  unidad_medida: string;
}

interface Bodega {
  id_bodega: number;
  nombre_bodega: string;
}

interface StockActualizado {
  nombre_producto: string;
  nombre_bodega: string;
  cantidad_disponible: number;
  unidad_medida: string;
  ultima_actualizacion: string;
}

const ACCENT_DUENO = "#2d6a4f";

export default function EntradaInventarioPage() {
  const usuario = useDuenoSession();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<StockActualizado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    id_bodega: "",
    id_producto: "",
    cantidad: "",
    tipo_ingreso: "UNIDADES",
    descripcion: "",
  });

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductos(data.productos || []));

    fetch("/api/bodegas")
      .then((r) => r.json())
      .then((data) => setBodegas(data.bodegas || []));
  }, [usuario]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
    setResultado(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const res = await fetch("/api/inventario/entrada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_bodega: Number(form.id_bodega),
          id_producto: Number(form.id_producto),
          cantidad: Number(form.cantidad),
          tipo_ingreso: form.tipo_ingreso,
          descripcion: form.descripcion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error desconocido");
      } else {
        setResultado(data.stock);
        setForm({
          id_bodega: form.id_bodega,
          id_producto: "",
          cantidad: "",
          tipo_ingreso: "UNIDADES",
          descripcion: "",
        });
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const productoSeleccionado = productos.find(
    (p) => p.id_producto === Number(form.id_producto)
  );

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const accent = ACCENT_DUENO;

  return (
    <StaffShell
      usuario={usuario}
      title="Entrada de inventario"
      subtitle="Registrar ingreso de productos a bodega"
    >
      <div
        style={{
          maxWidth: 640,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.75rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
            borderBottom: `2px solid ${accent}`,
            paddingBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "2.2rem" }}>📦</span>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
              Los movimientos quedan registrados en el kardex.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={field}>
            <label style={label}>Bodega *</label>
            <select
              name="id_bodega"
              value={form.id_bodega}
              onChange={handleChange}
              style={input}
            >
              <option value="">— Selecciona una bodega —</option>
              {bodegas.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.nombre_bodega}
                </option>
              ))}
            </select>
          </div>

          <div style={field}>
            <label style={label}>Producto *</label>
            <select
              name="id_producto"
              value={form.id_producto}
              onChange={handleChange}
              style={input}
            >
              <option value="">— Selecciona un producto —</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  [{p.codigo_producto}] {p.nombre_producto}
                </option>
              ))}
            </select>
            {productoSeleccionado && (
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Unidad de medida:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {productoSeleccionado.unidad_medida}
                </strong>
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ ...field, flex: "1 1 200px" }}>
              <label style={label}>Tipo de ingreso *</label>
              <select
                name="tipo_ingreso"
                value={form.tipo_ingreso}
                onChange={handleChange}
                style={input}
              >
                <option value="UNIDADES">Unidades</option>
                <option value="CAJAS">Cajas</option>
              </select>
            </div>

            <div style={{ ...field, flex: "1 1 200px" }}>
              <label style={label}>Cantidad *</label>
              <input
                type="number"
                name="cantidad"
                value={form.cantidad}
                onChange={handleChange}
                placeholder="0"
                min="0.001"
                step="0.001"
                style={input}
              />
            </div>
          </div>

          <div style={field}>
            <label style={label}>Descripción / observaciones</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Ej: Compra a proveedor XYZ, factura #001..."
              rows={3}
              style={{ ...input, resize: "vertical" }}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              loading ||
              !form.id_bodega ||
              !form.id_producto ||
              !form.cantidad
            }
            style={{
              background: accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.85rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor:
                loading ||
                !form.id_bodega ||
                !form.id_producto ||
                !form.cantidad
                  ? "not-allowed"
                  : "pointer",
              opacity:
                loading ||
                !form.id_bodega ||
                !form.id_producto ||
                !form.cantidad
                  ? 0.55
                  : 1,
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Registrando…" : "Registrar entrada"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: "1rem",
              background: "rgba(248,81,73,.12)",
              border: "1px solid rgba(248,81,73,.3)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              color: "var(--red)",
            }}
          >
            {error}
          </div>
        )}

        {resultado && (
          <div
            style={{
              marginTop: "1rem",
              background: "rgba(63,185,80,.12)",
              border: "1px solid rgba(63,185,80,.35)",
              borderRadius: 8,
              padding: "1rem",
              color: "var(--green)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--text)" }}>
              Entrada registrada
            </h3>
            <p style={{ margin: "0.2rem 0", color: "var(--muted)" }}>
              <strong style={{ color: "var(--text)" }}>Producto:</strong>{" "}
              {resultado.nombre_producto}
            </p>
            <p style={{ margin: "0.2rem 0", color: "var(--muted)" }}>
              <strong style={{ color: "var(--text)" }}>Bodega:</strong>{" "}
              {resultado.nombre_bodega}
            </p>
            <p style={{ margin: "0.2rem 0", color: "var(--muted)" }}>
              <strong style={{ color: "var(--text)" }}>Stock actual:</strong>{" "}
              {Number(resultado.cantidad_disponible).toFixed(2)}{" "}
              {resultado.unidad_medida}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              {new Date(resultado.ultima_actualizacion).toLocaleString("es-GT")}
            </p>
          </div>
        )}
      </div>
    </StaffShell>
  );
}

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const label: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.88rem",
  color: "var(--muted)",
};

const input: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: "0.95rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
