export const UNIDADES_LIQUIDAS = ["botella", "litro", "lt", "ml", "galon", "galón"];

export function esUnidadLiquida(unidad: string): boolean {
  const valor = unidad.trim().toLowerCase();
  return UNIDADES_LIQUIDAS.some((k) => valor.includes(k));
}

export function esUnidadLibra(unidad: string): boolean {
  return unidad.trim().toLowerCase().includes("libra");
}

export type ProductoFormValues = {
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  id_categoria: string;
  id_marca: string;
  caducidad: boolean;
  fecha_caducidad: string;
  exento_iva: boolean;
  estado_producto: boolean;
};

export const PRODUCTO_FORM_VACIO: ProductoFormValues = {
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

export type ProductoEditable = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string | number | null;
  precio_mayoreo: string | number | null;
  unidad_medida: string;
  id_categoria: number;
  id_marca: number;
  caducidad: boolean;
  fecha_caducidad?: string | null;
  exento_iva: boolean;
  estado_producto: boolean;
};

export type PresentacionForm = {
  nombre_presentacion: string;
  factor_conversion: string;
};

export type PresentacionPayload = {
  nombre_presentacion: string;
  factor_conversion: number;
};

export type ProductoPayload = {
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: number | null;
  precio_mayoreo: number | null;
  unidad_medida: string;
  id_categoria: number;
  id_marca: number;
  caducidad: boolean;
  fecha_caducidad: string | null;
  exento_iva: boolean;
  estado_producto: boolean;
  id_proveedores?: number[];
  presentaciones?: PresentacionPayload[];
};

export type ProductoFormValidado =
  | { ok: true; payload: ProductoPayload }
  | { ok: false; error: string };

function precioOpcional(valor: string): number | null {
  if (valor.trim() === "") return null;
  return Number(valor);
}

function fechaParaInput(valor: string | null | undefined): string {
  return valor ? valor.slice(0, 10) : "";
}

export function productoAFormValues(producto: ProductoEditable): ProductoFormValues {
  return {
    codigo_producto: producto.codigo_producto,
    nombre_producto: producto.nombre_producto,
    precio_unitario: producto.precio_unitario == null ? "" : String(producto.precio_unitario),
    precio_mayoreo: producto.precio_mayoreo == null ? "" : String(producto.precio_mayoreo),
    unidad_medida: producto.unidad_medida,
    id_categoria: String(producto.id_categoria),
    id_marca: String(producto.id_marca),
    caducidad: producto.caducidad,
    fecha_caducidad: fechaParaInput(producto.fecha_caducidad),
    exento_iva: producto.exento_iva,
    estado_producto: producto.estado_producto,
  };
}

export function presentacionesValidas(filas: PresentacionForm[]): PresentacionPayload[] {
  return filas
    .map((fila) => ({
      nombre_presentacion: fila.nombre_presentacion.trim(),
      factor_conversion: Number(fila.factor_conversion),
    }))
    .filter((fila) => fila.nombre_presentacion && fila.factor_conversion > 0);
}

export function validarProductoForm(
  values: ProductoFormValues,
  opciones: {
    esEdicion: boolean;
    presentaciones?: PresentacionForm[];
    idProveedores?: number[];
  }
): ProductoFormValidado {
  const codigo = values.codigo_producto.trim();
  const nombre = values.nombre_producto.trim();
  const unidad = values.unidad_medida.trim();

  if (!codigo || !nombre || !unidad || !values.id_categoria || !values.id_marca) {
    return { ok: false, error: "Completa todos los campos obligatorios (*)" };
  }

  const precioUnitario = precioOpcional(values.precio_unitario);
  const precioMayoreo = precioOpcional(values.precio_mayoreo);

  if (
    (precioUnitario !== null && (!Number.isFinite(precioUnitario) || precioUnitario < 0)) ||
    (precioMayoreo !== null && (!Number.isFinite(precioMayoreo) || precioMayoreo < 0))
  ) {
    return { ok: false, error: "Los precios deben ser números mayores o iguales a 0" };
  }

  const presentaciones = presentacionesValidas(opciones.presentaciones ?? []);

  if (!opciones.esEdicion && esUnidadLiquida(unidad) && presentaciones.length === 0) {
    return {
      ok: false,
      error: "Los productos líquidos necesitan al menos una presentación tipo caja",
    };
  }

  return {
    ok: true,
    payload: {
      codigo_producto: codigo,
      nombre_producto: nombre,
      precio_unitario: precioUnitario,
      precio_mayoreo: precioMayoreo,
      unidad_medida: unidad,
      id_categoria: Number(values.id_categoria),
      id_marca: Number(values.id_marca),
      caducidad: values.caducidad,
      fecha_caducidad: values.caducidad ? values.fecha_caducidad || null : null,
      exento_iva: values.exento_iva,
      estado_producto: values.estado_producto,
      ...(opciones.esEdicion
        ? {}
        : {
            id_proveedores: opciones.idProveedores ?? [],
            presentaciones,
          }),
    },
  };
}
