import {
  porcentajeAplicable,
  calcularDescuentoLinea,
  elegirMejorDescuento,
  validarDescuento,
  validarAsignacion,
  isTipoDescuento,
  type Descuento,
} from "@/lib/descuentos";

describe("porcentajeAplicable", () => {
  const escala = [
    { cantidad_desde: 1, porcentaje: 0 },
    { cantidad_desde: 10, porcentaje: 5 },
    { cantidad_desde: 50, porcentaje: 10 },
  ];

  it("picks the highest threshold not exceeding the quantity", () => {
    expect(porcentajeAplicable(1, escala)).toBe(0);
    expect(porcentajeAplicable(9, escala)).toBe(0);
    expect(porcentajeAplicable(10, escala)).toBe(5);
    expect(porcentajeAplicable(49, escala)).toBe(5);
    expect(porcentajeAplicable(50, escala)).toBe(10);
    expect(porcentajeAplicable(1000, escala)).toBe(10);
  });

  it("returns 0 when no threshold applies", () => {
    expect(porcentajeAplicable(5, [{ cantidad_desde: 10, porcentaje: 7 }])).toBe(0);
    expect(porcentajeAplicable(5, [])).toBe(0);
  });

  it("is not confused by unordered tramos", () => {
    const desordenado = [
      { cantidad_desde: 50, porcentaje: 10 },
      { cantidad_desde: 1, porcentaje: 0 },
      { cantidad_desde: 10, porcentaje: 5 },
    ];
    expect(porcentajeAplicable(30, desordenado)).toBe(5);
  });
});

describe("calcularDescuentoLinea", () => {
  const cantidad = [{ cantidad_desde: 10, porcentaje: 5 }];

  it("returns zero when no tramo applies", () => {
    expect(calcularDescuentoLinea(5, 100, cantidad)).toEqual({ porcentaje: 0, monto: 0 });
  });

  it("computes the discount in exact cents", () => {
    // 20 unidades a Q10 = Q200, 5% = Q10
    expect(calcularDescuentoLinea(20, 200, cantidad)).toEqual({ porcentaje: 5, monto: 10 });
  });

  it("rounds to the nearest cent", () => {
    // Q33.33 * 5% = Q1.6665 -> Q1.67
    expect(calcularDescuentoLinea(20, 33.33, cantidad)).toEqual({ porcentaje: 5, monto: 1.67 });
  });

  it("handles 100%", () => {
    expect(calcularDescuentoLinea(10, 50, [{ cantidad_desde: 10, porcentaje: 100 }])).toEqual({
      porcentaje: 100,
      monto: 50,
    });
  });
});

describe("elegirMejorDescuento", () => {
  const reglaA: Descuento = {
    id_descuento: 1,
    nombre: "Mayoreo 10%",
    tipo: "CANTIDAD",
    tramos: [{ cantidad_desde: 10, porcentaje: 10 }],
  };
  const reglaB: Descuento = {
    id_descuento: 2,
    nombre: "Cliente VIP 5%",
    tipo: "PORCENTAJE",
    tramos: [{ cantidad_desde: 0, porcentaje: 5 }],
  };

  it("returns null when nothing applies", () => {
    expect(elegirMejorDescuento(5, 100, [reglaA])).toBeNull();
  });

  it("does not accumulate: the biggest discount wins", () => {
    const r = elegirMejorDescuento(20, 200, [reglaA, reglaB]);
    expect(r?.descuento.id_descuento).toBe(1);
    expect(r?.monto).toBe(20);
  });

  it("can pick a smaller rule when the bigger one doesn't apply", () => {
    const r = elegirMejorDescuento(5, 100, [reglaA, reglaB]);
    expect(r?.descuento.id_descuento).toBe(2);
    expect(r?.monto).toBe(5);
  });
});

describe("validarDescuento", () => {
  it("accepts a well-formed rule", () => {
    expect(validarDescuento("Mayoreo", "ESCALA", [
      { cantidad_desde: 1, porcentaje: 0 },
      { cantidad_desde: 10, porcentaje: 5 },
    ])).toBeNull();
  });

  it.each([
    ["", "PORCENTAJE", [{ cantidad_desde: 0, porcentaje: 5 }]],
    [123, "PORCENTAJE", [{ cantidad_desde: 0, porcentaje: 5 }]],
    ["X", "OTRO", [{ cantidad_desde: 0, porcentaje: 5 }]],
    ["X", "PORCENTAJE", []],
    ["X", "PORCENTAJE", "no-array"],
    ["X", "PORCENTAJE", [{ cantidad_desde: -1, porcentaje: 5 }]],
    ["X", "PORCENTAJE", [{ cantidad_desde: 1, porcentaje: 150 }]],
    ["X", "PORCENTAJE", [{ cantidad_desde: 1, porcentaje: 5 }, { cantidad_desde: 1, porcentaje: 10 }]],
  ])("rejects invalid input %#", (nombre, tipo, tramos) => {
    expect(validarDescuento(nombre, tipo, tramos)).not.toBeNull();
  });
});

describe("validarAsignacion", () => {
  it("accepts exactly one target", () => {
    expect(validarAsignacion(5, null)).toBeNull();
    expect(validarAsignacion(null, "MAYORISTA")).toBeNull();
  });

  it("accepts every tipo de cliente del catálogo (MINORISTA/MAYORISTA/EMPRESA/GOBIERNO)", () => {
    expect(validarAsignacion(null, "MINORISTA")).toBeNull();
    expect(validarAsignacion(null, "MAYORISTA")).toBeNull();
    expect(validarAsignacion(null, "EMPRESA")).toBeNull();
    expect(validarAsignacion(null, "GOBIERNO")).toBeNull();
  });

  it.each([
    [null, null],
    [5, "MINORISTA"],
    [0, null],
    [null, "OTRO"],
    [null, "Empresa"],
  ])("rejects invalid assignment %#", (idCliente, tipoCliente) => {
    expect(validarAsignacion(idCliente, tipoCliente)).not.toBeNull();
  });
});

describe("isTipoDescuento", () => {
  it("narrows valid tipos only", () => {
    expect(isTipoDescuento("PORCENTAJE")).toBe(true);
    expect(isTipoDescuento("ESCALA")).toBe(true);
    expect(isTipoDescuento("OTRO")).toBe(false);
    expect(isTipoDescuento(null)).toBe(false);
  });
});
