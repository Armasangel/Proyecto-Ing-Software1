"use client";

import { useEffect, useState } from "react";
import { Campo, Mensaje, enviarJson, inputCls, primaryBtnCls } from "@/components/crear/ui";

type ProductoOpcion = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
};

export function FormularioPresentacion() {
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [idProducto, setIdProducto] = useState("");
  const [nombre, setNombre] = useState("");
  const [factor, setFactor] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let activo = true;
    fetch("/api/productos")
      .then((res) => res.json())
      .then((data) => {
        if (activo) setProductos(Array.isArray(data.productos) ? data.productos : []);
      })
      .catch(() => {
        if (activo) setError("No se pudieron cargar los productos");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!idProducto) {
      setError("Selecciona un producto");
      return;
    }
    if (!nombre.trim() || !(Number(factor) > 0)) {
      setError("El nombre es obligatorio y el factor debe ser mayor a 0");
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/presentaciones", {
        id_producto: Number(idProducto),
        nombre_presentacion: nombre.trim(),
        factor_conversion: Number(factor),
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear la presentación"));
        return;
      }
      setOk(`Presentación «${nombre.trim()}» creada.`);
      setNombre("");
      setFactor("");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4">
      <Campo label="Producto" required>
        <select
          className={inputCls}
          value={idProducto}
          onChange={(e) => setIdProducto(e.target.value)}
          disabled={cargando || productos.length === 0}
        >
          <option value="">{cargando ? "Cargando productos…" : "Selecciona un producto"}</option>
          {productos.map((p) => (
            <option key={p.id_producto} value={p.id_producto}>
              {p.codigo_producto} — {p.nombre_producto}
            </option>
          ))}
        </select>
      </Campo>
      {!cargando && productos.length === 0 && (
        <p className="text-[0.85rem] text-ink-muted">
          Primero crea un producto en la pestaña Producto.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre de la presentación" required>
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Caja de 24"
          />
        </Campo>
        <Campo label="Factor de conversión" required hint="Unidades base que contiene, por ejemplo 24.">
          <input
            className={inputCls}
            type="number"
            min="0.001"
            step="0.001"
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
            placeholder="24"
          />
        </Campo>
      </div>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button
          type="submit"
          className={primaryBtnCls}
          disabled={guardando || cargando || productos.length === 0}
        >
          {guardando ? "Creando…" : "Crear presentación"}
        </button>
      </div>
    </form>
  );
}
