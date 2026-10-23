"use client";

import { useEffect, useState } from "react";
import { Campo, Mensaje, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/form";
import { enviarJson } from "@/lib/http";

type Opcion = { id: number; nombre: string };
type Proveedor = { id_proveedor: number; nombre_proveedor: string };
type PresentacionForm = { nombre_presentacion: string; factor_conversion: string };

const UNIDADES_LIQUIDAS = ["botella", "litro", "lt", "ml", "galon", "galón"];

const FORM_VACIO = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  id_categoria: "",
  id_marca: "",
  caducidad: false,
  fecha_caducidad: "",
  exento_iva: false,
  estado_producto: true,
};

function esUnidadLiquida(unidad: string) {
  const valor = unidad.trim().toLowerCase();
  return UNIDADES_LIQUIDAS.some((k) => valor.includes(k));
}

export function FormularioProducto() {
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [categorias, setCategorias] = useState<Opcion[]>([]);
  const [marcas, setMarcas] = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<number[]>([]);
  const [presentaciones, setPresentaciones] = useState<PresentacionForm[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let activo = true;
    Promise.all([
      fetch("/api/categorias").then((r) => r.json()),
      fetch("/api/marcas").then((r) => r.json()),
      fetch("/api/proveedores").then((r) => r.json()),
    ])
      .then(([dataCategorias, dataMarcas, dataProveedores]) => {
        if (!activo) return;
        setCategorias(
          (Array.isArray(dataCategorias.categorias) ? dataCategorias.categorias : []).map(
            (c: { id_categoria: number; nombre_categoria: string }) => ({
              id: c.id_categoria,
              nombre: c.nombre_categoria,
            })
          )
        );
        setMarcas(
          (Array.isArray(dataMarcas.marcas) ? dataMarcas.marcas : []).map(
            (m: { id_marca: number; nombre_marca: string }) => ({
              id: m.id_marca,
              nombre: m.nombre_marca,
            })
          )
        );
        setProveedores(Array.isArray(dataProveedores.proveedores) ? dataProveedores.proveedores : []);
      })
      .catch(() => {
        if (activo) setError("No se pudieron cargar categorías, marcas o proveedores");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const liquidoRequiereCaja = esUnidadLiquida(form.unidad_medida);
  const presentacionesValidas = presentaciones.filter(
    (p) => p.nombre_presentacion.trim() && Number(p.factor_conversion) > 0
  );

  function toggleProveedor(id: number) {
    setProveedoresSeleccionados((ids) =>
      ids.includes(id) ? ids.filter((actual) => actual !== id) : [...ids, id]
    );
  }

  function actualizarPresentacion(indice: number, campo: keyof PresentacionForm, valor: string) {
    setPresentaciones((filas) =>
      filas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila))
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (
      !form.codigo_producto.trim() ||
      !form.nombre_producto.trim() ||
      !form.unidad_medida.trim() ||
      !form.id_categoria ||
      !form.id_marca
    ) {
      setError("Completa todos los campos obligatorios");
      return;
    }
    if (liquidoRequiereCaja && presentacionesValidas.length === 0) {
      setError("Los productos líquidos necesitan al menos una presentación tipo caja");
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/productos", {
        codigo_producto: form.codigo_producto.trim(),
        nombre_producto: form.nombre_producto.trim(),
        precio_unitario: form.precio_unitario === "" ? null : Number(form.precio_unitario),
        precio_mayoreo: form.precio_mayoreo === "" ? null : Number(form.precio_mayoreo),
        unidad_medida: form.unidad_medida.trim(),
        id_categoria: Number(form.id_categoria),
        id_marca: Number(form.id_marca),
        caducidad: form.caducidad,
        fecha_caducidad: form.caducidad ? form.fecha_caducidad || null : null,
        exento_iva: form.exento_iva,
        estado_producto: form.estado_producto,
        id_proveedores: proveedoresSeleccionados,
        presentaciones: presentacionesValidas.map((p) => ({
          nombre_presentacion: p.nombre_presentacion.trim(),
          factor_conversion: Number(p.factor_conversion),
        })),
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear el producto"));
        return;
      }
      setOk(`Producto «${form.nombre_producto.trim()}» creado.`);
      setForm({ ...FORM_VACIO });
      setProveedoresSeleccionados([]);
      setPresentaciones([]);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Código" required>
          <input
            className={inputCls}
            value={form.codigo_producto}
            onChange={(e) => setForm((f) => ({ ...f, codigo_producto: e.target.value }))}
            placeholder="PROD-001"
          />
        </Campo>
        <Campo label="Nombre" required>
          <input
            className={inputCls}
            value={form.nombre_producto}
            onChange={(e) => setForm((f) => ({ ...f, nombre_producto: e.target.value }))}
            placeholder="Leche entera"
          />
        </Campo>
        <Campo label="Unidad de medida" required hint="Ej. unidad, libra, litro, botella.">
          <input
            className={inputCls}
            value={form.unidad_medida}
            onChange={(e) => setForm((f) => ({ ...f, unidad_medida: e.target.value }))}
            placeholder="unidad"
          />
        </Campo>
        <Campo label="Categoría" required>
          <select
            className={inputCls}
            value={form.id_categoria}
            onChange={(e) => setForm((f) => ({ ...f, id_categoria: e.target.value }))}
            disabled={cargando}
          >
            <option value="">{cargando ? "Cargando…" : "Selecciona una categoría"}</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Marca" required>
          <select
            className={inputCls}
            value={form.id_marca}
            onChange={(e) => setForm((f) => ({ ...f, id_marca: e.target.value }))}
            disabled={cargando}
          >
            <option value="">{cargando ? "Cargando…" : "Selecciona una marca"}</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Precio unitario">
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            value={form.precio_unitario}
            onChange={(e) => setForm((f) => ({ ...f, precio_unitario: e.target.value }))}
            placeholder="0.00"
          />
        </Campo>
        <Campo label="Precio mayoreo">
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            value={form.precio_mayoreo}
            onChange={(e) => setForm((f) => ({ ...f, precio_mayoreo: e.target.value }))}
            placeholder="0.00"
          />
        </Campo>
        <Campo label="Fecha de caducidad">
          <input
            className={inputCls}
            type="date"
            value={form.fecha_caducidad}
            onChange={(e) => setForm((f) => ({ ...f, fecha_caducidad: e.target.value }))}
            disabled={!form.caducidad}
          />
        </Campo>
      </div>

      {(!cargando && (categorias.length === 0 || marcas.length === 0)) && (
        <p className="text-[0.82rem] text-ink-muted">
          Necesitas al menos una categoría y una marca. Puedes crearlas en sus pestañas.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.caducidad}
            onChange={(e) => setForm((f) => ({ ...f, caducidad: e.target.checked }))}
          />
          Maneja fecha de caducidad
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.exento_iva}
            onChange={(e) => setForm((f) => ({ ...f, exento_iva: e.target.checked }))}
          />
          Exento de IVA
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.estado_producto}
            onChange={(e) => setForm((f) => ({ ...f, estado_producto: e.target.checked }))}
          />
          Producto activo
        </label>
      </div>

      {proveedores.length > 0 && (
        <fieldset className="rounded-control border border-[var(--border)] p-3">
          <legend className="px-1 text-[0.82rem] font-semibold text-ink-muted">
            Proveedores (opcional)
          </legend>
          <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
            {proveedores.map((p) => (
              <label key={p.id_proveedor} className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={proveedoresSeleccionados.includes(p.id_proveedor)}
                  onChange={() => toggleProveedor(p.id_proveedor)}
                />
                {p.nombre_proveedor}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="rounded-control border border-[var(--border)] p-3">
        <legend className="px-1 text-[0.82rem] font-semibold text-ink-muted">
          Presentaciones por mayor {liquidoRequiereCaja ? "(obligatoria para líquidos)" : "(opcional)"}
        </legend>
        <div className="grid gap-2">
          {presentaciones.map((p, indice) => (
            <div key={indice} className="flex flex-wrap gap-2">
              <input
                className={`${inputCls} flex-1`}
                value={p.nombre_presentacion}
                onChange={(e) => actualizarPresentacion(indice, "nombre_presentacion", e.target.value)}
                placeholder="Caja de 24"
              />
              <input
                className={`${inputCls} w-32`}
                type="number"
                min="0.001"
                step="0.001"
                value={p.factor_conversion}
                onChange={(e) => actualizarPresentacion(indice, "factor_conversion", e.target.value)}
                placeholder="24"
              />
              <button
                type="button"
                className={secondaryBtnCls}
                onClick={() => setPresentaciones((filas) => filas.filter((_, i) => i !== indice))}
              >
                Quitar
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryBtnCls}
              onClick={() =>
                setPresentaciones((filas) => [
                  ...filas,
                  { nombre_presentacion: "", factor_conversion: "" },
                ])
              }
            >
              + Agregar presentación
            </button>
            {liquidoRequiereCaja && (
              <button
                type="button"
                className={secondaryBtnCls}
                onClick={() =>
                  setPresentaciones((filas) => [
                    ...filas,
                    { nombre_presentacion: "Caja", factor_conversion: "" },
                  ])
                }
              >
                + Agregar caja
              </button>
            )}
          </div>
        </div>
      </fieldset>

      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando || cargando}>
          {guardando ? "Creando…" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
