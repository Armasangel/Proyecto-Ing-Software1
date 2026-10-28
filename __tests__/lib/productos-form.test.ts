import {
  PRODUCTO_FORM_VACIO,
  esUnidadLibra,
  esUnidadLiquida,
  presentacionesValidas,
  productoAFormValues,
  validarProductoForm,
  type ProductoFormValues,
} from "@/lib/productos-form";

const base: ProductoFormValues = {
  ...PRODUCTO_FORM_VACIO,
  codigo_producto: "  ARR-001 ",
  nombre_producto: "  Arroz 1 libra ",
  unidad_medida: "  libra ",
  id_categoria: "2",
  id_marca: "3",
  precio_unitario: "4.50",
  precio_mayoreo: "",
};

describe("productos-form", () => {
  it("detecta unidades líquidas y libras", () => {
    expect(esUnidadLiquida("Botella")).toBe(true);
    expect(esUnidadLiquida("litro")).toBe(true);
    expect(esUnidadLiquida("libra")).toBe(false);
    expect(esUnidadLibra("Libra")).toBe(true);
  });

  it("valida los campos obligatorios", () => {
    const resultado = validarProductoForm(
      { ...base, nombre_producto: " " },
      { esEdicion: false }
    );

    expect(resultado).toEqual({
      ok: false,
      error: "Completa todos los campos obligatorios (*)",
    });
  });

  it("recorta textos y convierte números al crear", () => {
    const resultado = validarProductoForm(base, {
      esEdicion: false,
      idProveedores: [4, 5],
      presentaciones: [{ nombre_presentacion: " Saco de 50 ", factor_conversion: "50" }],
    });

    expect(resultado).toEqual({
      ok: true,
      payload: {
        codigo_producto: "ARR-001",
        nombre_producto: "Arroz 1 libra",
        precio_unitario: 4.5,
        precio_mayoreo: null,
        unidad_medida: "libra",
        id_categoria: 2,
        id_marca: 3,
        caducidad: false,
        fecha_caducidad: null,
        exento_iva: false,
        estado_producto: true,
        id_proveedores: [4, 5],
        presentaciones: [{ nombre_presentacion: "Saco de 50", factor_conversion: 50 }],
      },
    });
  });

  it("exige una presentación válida para productos líquidos al crear", () => {
    const resultado = validarProductoForm(
      { ...base, unidad_medida: "botella" },
      { esEdicion: false, presentaciones: [{ nombre_presentacion: "", factor_conversion: "" }] }
    );

    expect(resultado).toEqual({
      ok: false,
      error: "Los productos líquidos necesitan al menos una presentación tipo caja",
    });
  });

  it("no exige presentaciones ni envía extras al editar", () => {
    const resultado = validarProductoForm(
      { ...base, unidad_medida: "botella", precio_unitario: "" },
      {
        esEdicion: true,
        idProveedores: [4],
        presentaciones: [],
      }
    );

    expect(resultado).toMatchObject({
      ok: true,
      payload: {
        precio_unitario: null,
        precio_mayoreo: null,
      },
    });
    if (resultado.ok) {
      expect(resultado.payload).not.toHaveProperty("id_proveedores");
      expect(resultado.payload).not.toHaveProperty("presentaciones");
    }
  });

  it("rechaza precios negativos", () => {
    const resultado = validarProductoForm(
      { ...base, precio_unitario: "-1" },
      { esEdicion: false }
    );

    expect(resultado).toEqual({
      ok: false,
      error: "Los precios deben ser números mayores o iguales a 0",
    });
  });

  it("filtra presentaciones incompletas", () => {
    expect(
      presentacionesValidas([
        { nombre_presentacion: "Caja", factor_conversion: "12" },
        { nombre_presentacion: " ", factor_conversion: "4" },
        { nombre_presentacion: "Saco", factor_conversion: "0" },
      ])
    ).toEqual([{ nombre_presentacion: "Caja", factor_conversion: 12 }]);
  });

  it("convierte un producto de la API al formulario", () => {
    expect(
      productoAFormValues({
        id_producto: 1,
        codigo_producto: "LEC-01",
        nombre_producto: "Leche",
        precio_unitario: "25.00",
        precio_mayoreo: null,
        unidad_medida: "litro",
        id_categoria: 1,
        id_marca: 2,
        caducidad: true,
        fecha_caducidad: "2026-11-30T06:00:00.000Z",
        exento_iva: true,
        estado_producto: false,
      })
    ).toEqual({
      codigo_producto: "LEC-01",
      nombre_producto: "Leche",
      precio_unitario: "25.00",
      precio_mayoreo: "",
      unidad_medida: "litro",
      id_categoria: "1",
      id_marca: "2",
      caducidad: true,
      fecha_caducidad: "2026-11-30",
      exento_iva: true,
      estado_producto: false,
    });
  });
});
