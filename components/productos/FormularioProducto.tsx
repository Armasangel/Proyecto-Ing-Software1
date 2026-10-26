"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Campo, Mensaje, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/form";
import { enviarJson } from "@/lib/http";
import { actualizarProducto, crearProducto } from "@/lib/productos-api";
import {
  PRODUCTO_FORM_VACIO,
  esUnidadLibra,
  esUnidadLiquida,
  productoAFormValues,
  validarProductoForm,
  type PresentacionForm,
  type ProductoEditable,
  type ProductoFormValues,
} from "@/lib/productos-form";

type Opcion = { id: number; nombre: string };
type Proveedor = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor?: string | null;
  correo_contacto?: string | null;
  telefono?: string | null;
};

type FormularioProductoProps = {
  producto?: ProductoEditable | null;
  variant?: "page" | "modal";
  onGuardado?: (resultado: { idProducto: number | null; esEdicion: boolean }) => void | Promise<void>;
  onCancelar?: () => void;
  onCatalogosCambiados?: () => void;
  textoBoton?: string;
};

const PROVEEDOR_VACIO = {
  nombre_proveedor: "",
  nit_proveedor: "",
  correo_contacto: "",
  telefono: "",
};

export function FormularioProducto({
  producto = null,
  variant = "page",
  onGuardado,
  onCancelar,
  onCatalogosCambiados,
  textoBoton,
}: FormularioProductoProps) {
  const esEdicion = Boolean(producto);
  const [form, setForm] = useState<ProductoFormValues>(() =>
    producto ? productoAFormValues(producto) : { ...PRODUCTO_FORM_VACIO }
  );
  const [categorias, setCategorias] = useState<Opcion[]>([]);
  const [marcas, setMarcas] = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<number[]>([]);
  const [presentacionesForm, setPresentacionesForm] = useState<PresentacionForm[]>([]);
  const [proveedorQuery, setProveedorQuery] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState("");
  const [creandoMarca, setCreandoMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState("");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [errorMarca, setErrorMarca] = useState("");

  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [formProveedorNuevo, setFormProveedorNuevo] = useState(PROVEEDOR_VACIO);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [errorProveedor, setErrorProveedor] = useState("");

  useEffect(() => {
    let activo = true;
    Promise.all([
      fetch("/api/categorias").then((r) => r.json()),
      fetch("/api/marcas").then((r) => r.json()),
      fetch("/api/proveedores").then((r) => (r.ok ? r.json() : { proveedores: [] })),
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

  useEffect(() => {
    setForm(producto ? productoAFormValues(producto) : { ...PRODUCTO_FORM_VACIO });
  }, [producto]);

  const liquidoRequiereCaja = esUnidadLiquida(form.unidad_medida);
  const esLibra = esUnidadLibra(form.unidad_medida);
  const proveedoresFiltrados = proveedores.filter(
    (p) =>
      !proveedoresSeleccionados.includes(p.id_proveedor) &&
      (p.nombre_proveedor.toLowerCase().includes(proveedorQuery.trim().toLowerCase()) ||
        (p.nit_proveedor ?? "").toLowerCase().includes(proveedorQuery.trim().toLowerCase()))
  );

  const set = <K extends keyof ProductoFormValues>(campo: K, valor: ProductoFormValues[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  function agregarPresentacion(nombrePreset = "") {
    setPresentacionesForm((filas) => [
      ...filas,
      { nombre_presentacion: nombrePreset, factor_conversion: "" },
    ]);
  }

  function actualizarPresentacion(
    indice: number,
    campo: keyof PresentacionForm,
    valor: string
  ) {
    setPresentacionesForm((filas) =>
      filas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila))
    );
  }

  function toggleProveedor(id: number) {
    setProveedoresSeleccionados((ids) =>
      ids.includes(id) ? ids.filter((actual) => actual !== id) : [...ids, id]
    );
  }

  async function guardarCategoriaNueva() {
    setErrorCategoria("");
    if (!nuevaCategoriaNombre.trim()) {
      setErrorCategoria("El nombre es obligatorio");
      return;
    }
    setGuardandoCategoria(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/categorias", {
        nombre_categoria: nuevaCategoriaNombre.trim(),
      });
      const categoria = data.categoria as
        | { id_categoria: number; nombre_categoria: string }
        | undefined;
      if (!exito || !categoria) {
        setErrorCategoria(String(data.error || "Error al crear la categoría"));
        return;
      }
      setCategorias((prev) =>
        [...prev, { id: categoria.id_categoria, nombre: categoria.nombre_categoria }].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        )
      );
      set("id_categoria", String(categoria.id_categoria));
      setNuevaCategoriaNombre("");
      setCreandoCategoria(false);
      onCatalogosCambiados?.();
    } catch {
      setErrorCategoria("Error de conexión");
    } finally {
      setGuardandoCategoria(false);
    }
  }

  async function guardarMarcaNueva() {
    setErrorMarca("");
    if (!nuevaMarcaNombre.trim()) {
      setErrorMarca("El nombre es obligatorio");
      return;
    }
    setGuardandoMarca(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/marcas", {
        nombre_marca: nuevaMarcaNombre.trim(),
      });
      const marca = data.marca as { id_marca: number; nombre_marca: string } | undefined;
      if (!exito || !marca) {
        setErrorMarca(String(data.error || "Error al crear la marca"));
        return;
      }
      setMarcas((prev) =>
        [...prev, { id: marca.id_marca, nombre: marca.nombre_marca }].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        )
      );
      set("id_marca", String(marca.id_marca));
      setNuevaMarcaNombre("");
      setCreandoMarca(false);
      onCatalogosCambiados?.();
    } catch {
      setErrorMarca("Error de conexión");
    } finally {
      setGuardandoMarca(false);
    }
  }

  async function guardarProveedorNuevo() {
    setErrorProveedor("");
    if (!formProveedorNuevo.nombre_proveedor.trim() || !formProveedorNuevo.nit_proveedor.trim()) {
      setErrorProveedor("Nombre y NIT son obligatorios");
      return;
    }
    setGuardandoProveedor(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/proveedores", formProveedorNuevo);
      const proveedor = data.proveedor as Proveedor | undefined;
      if (!exito || !proveedor) {
        setErrorProveedor(String(data.error || "Error al crear el proveedor"));
        return;
      }
      setProveedores((prev) => [...prev, proveedor]);
      setProveedoresSeleccionados((prev) => [...prev, proveedor.id_proveedor]);
      setFormProveedorNuevo(PROVEEDOR_VACIO);
      setCreandoProveedor(false);
      onCatalogosCambiados?.();
    } catch {
      setErrorProveedor("Error de conexión");
    } finally {
      setGuardandoProveedor(false);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");

    const validado = validarProductoForm(form, {
      esEdicion,
      presentaciones: presentacionesForm,
      idProveedores: proveedoresSeleccionados,
    });
    if (!validado.ok) {
      setError(validado.error);
      return;
    }

    setGuardando(true);
    try {
      const resultado =
        esEdicion && producto
          ? await actualizarProducto(producto.id_producto, validado.payload)
          : await crearProducto(validado.payload);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      const nombre = validado.payload.nombre_producto;
      setOk(esEdicion ? `Producto «${nombre}» actualizado.` : `Producto «${nombre}» creado.`);

      if (!esEdicion && variant === "page") {
        setForm({ ...PRODUCTO_FORM_VACIO });
        setProveedoresSeleccionados([]);
        setPresentacionesForm([]);
      }

      await onGuardado?.({ idProducto: resultado.idProducto, esEdicion });
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={guardar}
      noValidate
      className={variant === "modal" ? "grid gap-3" : "grid gap-4"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Código" required>
          <input
            className={inputCls}
            value={form.codigo_producto}
            onChange={(e) => set("codigo_producto", e.target.value)}
            placeholder="PROD-001"
          />
        </Campo>
        <Campo label="Nombre" required>
          <input
            className={inputCls}
            value={form.nombre_producto}
            onChange={(e) => set("nombre_producto", e.target.value)}
            placeholder="Leche entera"
          />
        </Campo>
        <Campo label="Unidad de medida" required hint="Ej. unidad, libra, litro, botella.">
          <input
            className={inputCls}
            value={form.unidad_medida}
            onChange={(e) => set("unidad_medida", e.target.value)}
            placeholder="unidad"
          />
        </Campo>
        <Campo label="Categoría" required>
          <select
            className={inputCls}
            value={form.id_categoria}
            onChange={(e) => set("id_categoria", e.target.value)}
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
            onChange={(e) => set("id_marca", e.target.value)}
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
            onChange={(e) => set("precio_unitario", e.target.value)}
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
            onChange={(e) => set("precio_mayoreo", e.target.value)}
            placeholder="0.00"
          />
        </Campo>
        {form.caducidad && (
          <Campo label="Fecha de caducidad">
            <input
              className={inputCls}
              type="date"
              value={form.fecha_caducidad}
              onChange={(e) => set("fecha_caducidad", e.target.value)}
            />
          </Campo>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.caducidad}
            onChange={(e) => set("caducidad", e.target.checked)}
          />
          Maneja fecha de caducidad
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.exento_iva}
            onChange={(e) => set("exento_iva", e.target.checked)}
          />
          Exento de IVA
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.estado_producto}
            onChange={(e) => set("estado_producto", e.target.checked)}
          />
          Producto activo
        </label>
      </div>

      {!esEdicion && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryBtnCls}
              onClick={() => setCreandoCategoria((v) => !v)}
            >
              + Categoría nueva
            </button>
            <button
              type="button"
              className={secondaryBtnCls}
              onClick={() => setCreandoMarca((v) => !v)}
            >
              + Marca nueva
            </button>
          </div>

          {creandoCategoria && (
            <div className="grid gap-2 rounded-control border border-[var(--border)] p-3 sm:grid-cols-[1fr_auto]">
              <Campo label="Nombre de la categoría nueva">
                <input
                  className={inputCls}
                  value={nuevaCategoriaNombre}
                  onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                />
              </Campo>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className={primaryBtnCls}
                  onClick={guardarCategoriaNueva}
                  disabled={guardandoCategoria}
                >
                  {guardandoCategoria ? "Guardando…" : "Guardar categoría"}
                </button>
                <button
                  type="button"
                  className={secondaryBtnCls}
                  onClick={() => setCreandoCategoria(false)}
                  disabled={guardandoCategoria}
                >
                  Cancelar
                </button>
              </div>
              <Mensaje tipo="error">{errorCategoria}</Mensaje>
            </div>
          )}

          {creandoMarca && (
            <div className="grid gap-2 rounded-control border border-[var(--border)] p-3 sm:grid-cols-[1fr_auto]">
              <Campo label="Nombre de la marca nueva">
                <input
                  className={inputCls}
                  value={nuevaMarcaNombre}
                  onChange={(e) => setNuevaMarcaNombre(e.target.value)}
                />
              </Campo>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className={primaryBtnCls}
                  onClick={guardarMarcaNueva}
                  disabled={guardandoMarca}
                >
                  {guardandoMarca ? "Guardando…" : "Guardar marca"}
                </button>
                <button
                  type="button"
                  className={secondaryBtnCls}
                  onClick={() => setCreandoMarca(false)}
                  disabled={guardandoMarca}
                >
                  Cancelar
                </button>
              </div>
              <Mensaje tipo="error">{errorMarca}</Mensaje>
            </div>
          )}

          <fieldset className="rounded-control border border-[var(--border)] p-3">
            <legend className="px-1 text-[0.82rem] font-semibold text-ink-muted">
              Proveedores (opcional)
            </legend>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <input
                  className={inputCls}
                  placeholder="Buscar proveedor por nombre o NIT…"
                  value={proveedorQuery}
                  onChange={(e) => setProveedorQuery(e.target.value)}
                  disabled={cargando}
                />
                {proveedorQuery.trim() !== "" && (
                  <div className="absolute left-0 right-0 z-20 mt-0.5 max-h-40 overflow-y-auto rounded-control border border-[var(--border)] bg-white shadow-warm">
                    {proveedoresFiltrados.length === 0 ? (
                      <p className="px-3 py-2 text-[0.82rem] text-ink-muted">
                        Sin resultados — prueba &quot;+ Proveedor nuevo&quot;.
                      </p>
                    ) : (
                      proveedoresFiltrados.slice(0, 8).map((p) => (
                        <button
                          key={p.id_proveedor}
                          type="button"
                          className="block w-full border-b border-[var(--border)] px-3 py-2 text-left text-[0.85rem] last:border-0 hover:bg-cream-100"
                          onClick={() => {
                            toggleProveedor(p.id_proveedor);
                            setProveedorQuery("");
                          }}
                        >
                          {p.nombre_proveedor}{" "}
                          <span className="text-ink-muted">({p.nit_proveedor})</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={secondaryBtnCls}
                onClick={() => setCreandoProveedor((v) => !v)}
              >
                + Proveedor nuevo
              </button>
            </div>

            {proveedoresSeleccionados.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {proveedoresSeleccionados.map((id) => {
                  const proveedor = proveedores.find((p) => p.id_proveedor === id);
                  if (!proveedor) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-cream-100 px-2.5 py-1 text-[0.8rem]"
                    >
                      {proveedor.nombre_proveedor}
                      <button
                        type="button"
                        className="text-ink-muted"
                        aria-label={`Quitar ${proveedor.nombre_proveedor}`}
                        onClick={() => toggleProveedor(id)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {creandoProveedor && (
              <div className="mt-3 grid gap-2 rounded-control bg-cream-100 p-3 sm:grid-cols-2">
                <Campo label="Nombre del proveedor">
                  <input
                    className={inputCls}
                    value={formProveedorNuevo.nombre_proveedor}
                    onChange={(e) =>
                      setFormProveedorNuevo((f) => ({ ...f, nombre_proveedor: e.target.value }))
                    }
                  />
                </Campo>
                <Campo label="NIT del proveedor">
                  <input
                    className={inputCls}
                    value={formProveedorNuevo.nit_proveedor}
                    onChange={(e) =>
                      setFormProveedorNuevo((f) => ({ ...f, nit_proveedor: e.target.value }))
                    }
                  />
                </Campo>
                <Campo label="Correo del proveedor">
                  <input
                    className={inputCls}
                    value={formProveedorNuevo.correo_contacto}
                    onChange={(e) =>
                      setFormProveedorNuevo((f) => ({ ...f, correo_contacto: e.target.value }))
                    }
                  />
                </Campo>
                <Campo label="Teléfono del proveedor">
                  <input
                    className={inputCls}
                    value={formProveedorNuevo.telefono}
                    onChange={(e) =>
                      setFormProveedorNuevo((f) => ({ ...f, telefono: e.target.value }))
                    }
                  />
                </Campo>
                <Mensaje tipo="error">{errorProveedor}</Mensaje>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className={primaryBtnCls}
                    onClick={guardarProveedorNuevo}
                    disabled={guardandoProveedor}
                  >
                    {guardandoProveedor ? "Guardando…" : "Guardar proveedor"}
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-control border border-[var(--border)] p-3">
            <legend className="px-1 text-[0.82rem] font-semibold text-ink-muted">
              Presentaciones por mayor{" "}
              {liquidoRequiereCaja ? "(obligatoria para líquidos)" : "(opcional)"}
            </legend>
            <div className="grid gap-2">
              {presentacionesForm.map((p, indice) => (
                <div key={indice} className="flex flex-wrap gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={p.nombre_presentacion}
                    onChange={(e) =>
                      actualizarPresentacion(indice, "nombre_presentacion", e.target.value)
                    }
                    placeholder="Caja de 24"
                  />
                  <input
                    className={`${inputCls} w-32`}
                    type="number"
                    min="0"
                    step="1"
                    value={p.factor_conversion}
                    onChange={(e) =>
                      actualizarPresentacion(indice, "factor_conversion", e.target.value)
                    }
                    placeholder="24"
                  />
                  <button
                    type="button"
                    className={secondaryBtnCls}
                    onClick={() =>
                      setPresentacionesForm((filas) => filas.filter((_, i) => i !== indice))
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryBtnCls}
                  onClick={() => agregarPresentacion()}
                >
                  + Agregar presentación
                </button>
                {liquidoRequiereCaja && (
                  <button
                    type="button"
                    className={secondaryBtnCls}
                    onClick={() => agregarPresentacion("Caja")}
                  >
                    + Agregar caja
                  </button>
                )}
                {esLibra && (
                  <button
                    type="button"
                    className={secondaryBtnCls}
                    onClick={() => agregarPresentacion("Saco")}
                  >
                    + Agregar saco
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        </>
      )}

      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>

      <div className={variant === "modal" ? "flex justify-end gap-2 pt-1" : "flex gap-2"}>
        <button type="submit" className={primaryBtnCls} disabled={guardando || cargando}>
          {guardando
            ? esEdicion
              ? "Guardando…"
              : "Creando…"
            : textoBoton ?? (esEdicion ? "Guardar cambios" : "Crear producto")}
        </button>
        {onCancelar && (
          <button
            type="button"
            className={secondaryBtnCls}
            onClick={onCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
