"use client";
// app/inventario/entrada/page.tsx
// HU-04: Registro de entrada de inventario
// El bodeguero registra el ingreso de productos por unidades o cajas

import { useEffect, useState } from "react";

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

export default function EntradaInventarioPage() {
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

  // Cargar productos y bodegas al montar
  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductos(data.productos || []));

    fetch("/api/bodegas")
      .then((r) => r.json())
      .then((data) => setBodegas(data.bodegas || []));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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
        // Limpiar formulario
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

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerIcon}>📦</span>
          <div>
            <h1 style={styles.titulo}>Entrada de Inventario</h1>
            <p style={styles.subtitulo}>Registrar ingreso de productos a bodega</p>
          </div>
        </div>

        {/* Formulario */}
        <div style={styles.form}>

          {/* Bodega */}
          <div style={styles.campo}>
            <label style={styles.label}>Bodega *</label>
            <select name="id_bodega" value={form.id_bodega} onChange={handleChange} style={styles.input}>
              <option value="">— Selecciona una bodega —</option>
              {bodegas.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.nombre_bodega}
                </option>
              ))}
            </select>
          </div>

          {/* Producto */}
          <div style={styles.campo}>
            <label style={styles.label}>Producto *</label>
            <select name="id_producto" value={form.id_producto} onChange={handleChange} style={styles.input}>
              <option value="">— Selecciona un producto —</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  [{p.codigo_producto}] {p.nombre_producto}
                </option>
              ))}
            </select>
            {productoSeleccionado && (
              <span style={styles.hint}>
                Unidad de medida: <strong>{productoSeleccionado.unidad_medida}</strong>
              </span>
            )}
          </div>

          {/* Tipo de ingreso y cantidad en fila */}
          <div style={styles.fila}>
            <div style={{ ...styles.campo, flex: 1 }}>
              <label style={styles.label}>Tipo de ingreso *</label>
              <select name="tipo_ingreso" value={form.tipo_ingreso} onChange={handleChange} style={styles.input}>
                <option value="UNIDADES">Unidades</option>
                <option value="CAJAS">Cajas</option>
              </select>
            </div>

            <div style={{ ...styles.campo, flex: 1 }}>
              <label style={styles.label}>Cantidad *</label>
              <input
                type="number"
                name="cantidad"
                value={form.cantidad}
                onChange={handleChange}
                placeholder="0"
                min="0.001"
                step="0.001"
                style={styles.input}
              />
            </div>
          </div>

          {/* Descripción */}
          <div style={styles.campo}>
            <label style={styles.label}>Descripción / Observaciones</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Ej: Compra a proveedor XYZ, factura #001..."
              rows={3}
              style={{ ...styles.input, resize: "vertical" }}
            />
          </div>

          {/* Botón */}
          <button
            onClick={handleSubmit}
            disabled={loading || !form.id_bodega || !form.id_producto || !form.cantidad}
            style={{
              ...styles.boton,
              opacity: loading || !form.id_bodega || !form.id_producto || !form.cantidad ? 0.6 : 1,
            }}
          >
            {loading ? "Registrando..." : "✅ Registrar Entrada"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={styles.alerta}>
            ❌ {error}
          </div>
        )}

        {/* Éxito */}
        {resultado && (
          <div style={styles.exito}>
            <h3 style={{ margin: "0 0 0.5rem" }}>✅ Entrada registrada</h3>
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Producto:</strong> {resultado.nombre_producto}
            </p>
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Bodega:</strong> {resultado.nombre_bodega}
            </p>
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Stock actual:</strong>{" "}
              {Number(resultado.cantidad_disponible).toFixed(2)} {resultado.unidad_medida}
            </p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", color: "#555" }}>
              Última actualización: {new Date(resultado.ultima_actualizacion).toLocaleString("es-GT")}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f0f4f0",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: "sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 16px rgba(0,0,0,0.1)",
    padding: "2rem",
    width: "100%",
    maxWidth: 600,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1.5rem",
    borderBottom: "2px solid #1a6b3a",
    paddingBottom: "1rem",
  },
  headerIcon: { fontSize: "2.5rem" },
  titulo: { margin: 0, color: "#1a6b3a", fontSize: "1.5rem" },
  subtitulo: { margin: 0, color: "#666", fontSize: "0.9rem" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  campo: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  fila: { display: "flex", gap: "1rem" },
  label: { fontWeight: 600, fontSize: "0.9rem", color: "#333" },
  input: {
    padding: "0.6rem 0.8rem",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  hint: { fontSize: "0.8rem", color: "#888" },
  boton: {
    backgroundColor: "#1a6b3a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.8rem",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "0.5rem",
  },
  alerta: {
    marginTop: "1rem",
    backgroundColor: "#fdecea",
    border: "1px solid #f5c2c7",
    borderRadius: 8,
    padding: "0.8rem 1rem",
    color: "#842029",
  },
  exito: {
    marginTop: "1rem",
    backgroundColor: "#d1e7dd",
    border: "1px solid #a3cfbb",
    borderRadius: 8,
    padding: "0.8rem 1rem",
    color: "#0f5132",
  },
};