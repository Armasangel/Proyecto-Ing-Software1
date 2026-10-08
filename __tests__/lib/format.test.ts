import {
  formatMoney,
  roundMoney,
  formatNumber,
  formatQuantity,
  formatDate,
  formatDateTime,
  formatTime,
  formatDateLong,
  formatDayMonth,
  toISODate,
  EMPTY_VALUE,
} from "@/lib/format";

describe("formatMoney", () => {
  it("formatea con prefijo Q y 2 decimales", () => {
    expect(formatMoney(75)).toBe("Q75.00");
    expect(formatMoney(0.5)).toBe("Q0.50");
  });

  it("usa separador de miles", () => {
    expect(formatMoney(1234.5)).toBe("Q1,234.50");
    expect(formatMoney(1234567.891)).toBe("Q1,234,567.89");
  });

  it("acepta strings numéricos (como los devuelve pg para NUMERIC)", () => {
    expect(formatMoney("100")).toBe("Q100.00");
    expect(formatMoney("12.345")).toBe("Q12.35");
  });

  it("trata null/undefined/NaN como 0", () => {
    expect(formatMoney(null)).toBe("Q0.00");
    expect(formatMoney(undefined)).toBe("Q0.00");
    expect(formatMoney("abc")).toBe("Q0.00");
    expect(formatMoney(NaN)).toBe("Q0.00");
  });
});

describe("roundMoney", () => {
  it("redondea a 2 decimales y devuelve number", () => {
    expect(roundMoney(10.126)).toBe(10.13);
    expect(roundMoney("3.3333")).toBe(3.33);
    expect(typeof roundMoney(1)).toBe("number");
  });
  it("trata entradas inválidas como 0", () => {
    expect(roundMoney(null)).toBe(0);
  });
});

describe("formatNumber / formatQuantity", () => {
  it("formatNumber agrupa miles y respeta maxDecimals", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(1234.5678, { maxDecimals: 2 })).toBe("1,234.57");
    expect(formatNumber(5, { maxDecimals: 2 })).toBe("5");
  });

  it("formatQuantity usa decimales fijos (3 por defecto)", () => {
    expect(formatQuantity(12)).toBe("12.000");
    expect(formatQuantity("2.5")).toBe("2.500");
    expect(formatQuantity(12.3456, 2)).toBe("12.35");
    expect(formatQuantity(7.4, 0)).toBe("7");
  });
});

describe("fechas", () => {
  // Fecha construida en hora local para que el test no dependa de la zona horaria.
  const d = new Date(2026, 2, 5, 15, 7); // 5 de marzo de 2026, 15:07

  it("formatDate devuelve solo la fecha", () => {
    expect(formatDate(d)).toBe(d.toLocaleDateString("es-GT"));
    expect(formatDate(d)).toMatch(/5\/3\/2026/);
  });

  it("formatDate acepta strings ISO", () => {
    expect(formatDate(d.toISOString())).toBe(formatDate(d));
  });

  it("formatDateTime incluye fecha y hora cortas", () => {
    expect(formatDateTime(d)).toMatch(/3:07/);
    expect(formatDateTime(d)).toMatch(/26/);
  });

  it("formatTime devuelve solo la hora", () => {
    expect(formatTime(d)).toMatch(/03:07/);
  });

  it("formatDateLong incluye día de la semana y mes", () => {
    expect(formatDateLong(d)).toBe("jueves, 5 de marzo");
  });

  it("devuelve el fallback con fechas vacías o inválidas", () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE);
    expect(formatDate(undefined)).toBe(EMPTY_VALUE);
    expect(formatDate("")).toBe(EMPTY_VALUE);
    expect(formatDate("no-es-fecha")).toBe(EMPTY_VALUE);
    expect(formatDateTime("no-es-fecha", "sin fecha")).toBe("sin fecha");
    expect(formatTime(null)).toBe(EMPTY_VALUE);
  });

  it("formatDayMonth convierte YYYY-MM-DD a dd/mm sin depender de la zona horaria", () => {
    expect(formatDayMonth("2026-03-05")).toBe("05/03");
  });

  it("toISODate devuelve YYYY-MM-DD", () => {
    expect(toISODate(new Date("2026-03-05T12:00:00Z"))).toBe("2026-03-05");
    expect(toISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toISODate("basura")).toBe("");
  });
});
