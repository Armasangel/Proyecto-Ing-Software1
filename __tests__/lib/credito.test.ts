import {
  planConPagos,
  reglaDePago,
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

describe("planConPagos", () => {
  const plan3 = [
    { numero: 1, fecha_vencimiento: "2026-10-26", monto: 100 },
    { numero: 2, fecha_vencimiento: "2026-11-10", monto: 100 },
    { numero: 3, fecha_vencimiento: "2026-11-25", monto: 100 },
  ];

  it("everything pending when nothing was paid", () => {
    const r = planConPagos(plan3, [], "2026-10-12");
    expect(r.map((c) => c.estado)).toEqual(["PENDIENTE", "PENDIENTE", "PENDIENTE"]);
    expect(r.map((c) => c.monto)).toEqual([100, 100, 100]);
  });

  it("an exact payment covers its cuota and leaves the rest as planned", () => {
    const r = planConPagos(plan3, [100], "2026-10-12");
    expect(r.map((c) => c.estado)).toEqual(["PAGADA", "PENDIENTE", "PENDIENTE"]);
    expect(r.map((c) => c.monto)).toEqual([100, 100, 100]);
  });

  it("paying more than the cuota recalculates the remaining cuotas with what is left", () => {
    // Q300 en 3 pagos: paga Q150 en el 1º -> quedan Q150 repartidos en 2 pagos de Q75.
    const r = planConPagos(plan3, [150], "2026-10-12");
    expect(r.map((c) => c.estado)).toEqual(["PAGADA", "PENDIENTE", "PENDIENTE"]);
    expect(r[0]).toMatchObject({ pagado: 150, saldo: 0 });
    expect(r.slice(1).map((c) => c.monto)).toEqual([75, 75]);
  });

  it("keeps recalculating after each payment and splits cents exactly", () => {
    // Q100 en 3 pagos (33.33, 33.33, 33.34); paga Q50 en el 1º -> quedan Q50 en 2 pagos.
    const plan = [
      { numero: 1, fecha_vencimiento: "2026-10-26", monto: 33.33 },
      { numero: 2, fecha_vencimiento: "2026-11-10", monto: 33.33 },
      { numero: 3, fecha_vencimiento: "2026-11-25", monto: 33.34 },
    ];
    const r = planConPagos(plan, [50, 30], "2026-10-12");
    // 2º pago de Q30 cubre su cuota de Q25 y deja Q20 para la última.
    expect(r.map((c) => c.monto)).toEqual([33.33, 25, 20]);
    expect(r[1]).toMatchObject({ pagado: 30, estado: "PAGADA" });
    expect(r[2].estado).toBe("PENDIENTE");
    expect(Math.round(r.reduce((s, c) => s + c.saldo, 0) * 100)).toBe(2000);
  });

  it("a payment of the whole balance covers every remaining cuota", () => {
    const r = planConPagos(plan3, [300], "2026-10-12");
    expect(r.every((c) => c.estado === "PAGADA" && c.saldo === 0)).toBe(true);
  });

  it("flags unpaid cuotas past their due date as VENCIDA (and not on the due day)", () => {
    expect(planConPagos(plan3, [100], "2026-11-11").map((c) => c.estado)).toEqual(["PAGADA", "VENCIDA", "PENDIENTE"]);
    expect(planConPagos(plan3, [], "2026-10-26")[0].estado).toBe("PENDIENTE");
  });

  it("a payment smaller than the cuota (old data) stays as a partial payment", () => {
    const r = planConPagos(plan3, [40], "2026-10-12");
    expect(r[0]).toMatchObject({ estado: "PARCIAL", pagado: 40, saldo: 60 });
    expect(r.slice(1).map((c) => c.monto)).toEqual([100, 100]);
  });
});

describe("reglaDePago", () => {
  const plan = (n: number) =>
    generarCuotas("2026-10-11", 30, n, 300).map((c) => ({ ...c }));

  it("pago único: only the whole balance is accepted", () => {
    const r = reglaDePago(planConPagos(plan(1), [], "2026-10-12"));
    expect(r).toMatchObject({ pagoUnico: true, minimo: 300, maximo: 300, totalCuotas: 1 });
  });

  it("several pagos: minimum is the current cuota, maximum is the balance", () => {
    const r = reglaDePago(planConPagos(plan(3), [], "2026-10-12"));
    expect(r).toMatchObject({ pagoUnico: false, minimo: 100, maximo: 300 });
    expect(r.cuota?.numero).toBe(1);
  });

  it("moves to the next cuota with its recalculated amount after paying extra", () => {
    const r = reglaDePago(planConPagos(plan(3), [150], "2026-10-12"));
    expect(r).toMatchObject({ minimo: 75, maximo: 150 });
    expect(r.cuota?.numero).toBe(2);
  });

  it("nothing left to pay once everything is covered", () => {
    const r = reglaDePago(planConPagos(plan(2), [300], "2026-10-12"));
    expect(r).toMatchObject({ minimo: 0, maximo: 0, cuota: null });
  });
});
