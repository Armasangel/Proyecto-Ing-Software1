import {
  asignarPagosACuotas,
  diferenciaDias,
  esFechaISO,
  generarCuotas,
  sumarDias,
  validarCondicionesCredito,
} from "@/lib/credito";

describe("fechas", () => {
  it("validates real calendar dates only", () => {
    expect(esFechaISO("2026-10-11")).toBe(true);
    expect(esFechaISO("2026-02-30")).toBe(false);
    expect(esFechaISO("11/10/2026")).toBe(false);
    expect(esFechaISO(20261011)).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(sumarDias("2026-10-11", 30)).toBe("2026-11-10");
    expect(sumarDias("2026-12-20", 15)).toBe("2027-01-04");
    expect(sumarDias("2028-02-27", 2)).toBe("2028-02-29");
    expect(diferenciaDias("2026-10-11", "2026-11-10")).toBe(30);
  });
});

describe("validarCondicionesCredito", () => {
  it("accepts reasonable values", () => {
    expect(validarCondicionesCredito(30, 1)).toBeNull();
    expect(validarCondicionesCredito(60, 4)).toBeNull();
  });

  it.each([
    [0, 1],
    [366, 1],
    [30.5, 1],
    ["30", 1],
    [30, 0],
    [30, 25],
    [3, 4], // más pagos que días
  ])("rejects plazo=%p cuotas=%p", (plazo, cuotas) => {
    expect(validarCondicionesCredito(plazo, cuotas)).not.toBeNull();
  });
});

describe("generarCuotas", () => {
  it("single payment due at the end of the plazo", () => {
    expect(generarCuotas("2026-10-11", 30, 1, 1000)).toEqual([
      { numero: 1, fecha_vencimiento: "2026-11-10", monto: 1000 },
    ]);
  });

  it("two payments spaced evenly inside the plazo", () => {
    expect(generarCuotas("2026-10-11", 30, 2, 1000)).toEqual([
      { numero: 1, fecha_vencimiento: "2026-10-26", monto: 500 },
      { numero: 2, fecha_vencimiento: "2026-11-10", monto: 500 },
    ]);
  });

  it("splits in exact cents and puts the rounding remainder on the last cuota", () => {
    const cuotas = generarCuotas("2026-10-11", 90, 3, 100);
    expect(cuotas.map((c) => c.monto)).toEqual([33.33, 33.33, 33.34]);
    expect(Math.round(cuotas.reduce((s, c) => s + c.monto, 0) * 100)).toBe(10000);
  });

  it("due dates are strictly increasing and the last one is fecha + plazo", () => {
    const cuotas = generarCuotas("2026-01-31", 5, 4, 80);
    const fechas = cuotas.map((c) => c.fecha_vencimiento);
    expect([...fechas].sort()).toEqual(fechas);
    expect(new Set(fechas).size).toBe(4);
    expect(fechas[3]).toBe(sumarDias("2026-01-31", 5));
  });

  it("throws on invalid input", () => {
    expect(() => generarCuotas("2026-10-11", 30, 0, 100)).toThrow();
    expect(() => generarCuotas("no-fecha", 30, 1, 100)).toThrow();
    expect(() => generarCuotas("2026-10-11", 30, 1, 0)).toThrow();
  });
});

describe("asignarPagosACuotas", () => {
  const cuotas = [
    { numero: 1, fecha_vencimiento: "2026-10-26", monto: 500 },
    { numero: 2, fecha_vencimiento: "2026-11-10", monto: 500 },
  ];

  it("everything pending when nothing was paid", () => {
    const r = asignarPagosACuotas(cuotas, 0, "2026-10-12");
    expect(r.map((c) => c.estado)).toEqual(["PENDIENTE", "PENDIENTE"]);
  });

  it("applies payments in order and marks the partial one", () => {
    const r = asignarPagosACuotas(cuotas, "700.00", "2026-10-12");
    expect(r.map((c) => c.estado)).toEqual(["PAGADA", "PARCIAL"]);
    expect(r[1]).toMatchObject({ pagado: 200, saldo: 300 });
  });

  it("flags unpaid cuotas past their due date as VENCIDA", () => {
    const r = asignarPagosACuotas(cuotas, 500, "2026-11-11");
    expect(r.map((c) => c.estado)).toEqual(["PAGADA", "VENCIDA"]);
    // el día del vencimiento todavía no está vencida
    expect(asignarPagosACuotas(cuotas, 0, "2026-10-26")[0].estado).toBe("PENDIENTE");
  });

  it("fully paid", () => {
    const r = asignarPagosACuotas(cuotas, 1000, "2027-01-01");
    expect(r.every((c) => c.estado === "PAGADA" && c.saldo === 0)).toBe(true);
  });
});
