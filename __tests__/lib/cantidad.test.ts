import { sanitizeCantidad, stepCantidad } from "@/lib/cantidad";

describe("sanitizeCantidad", () => {
  it("deja pasar los enteros tal cual", () => {
    expect(sanitizeCantidad("1")).toBe("1");
    expect(sanitizeCantidad("12")).toBe("12");
    expect(sanitizeCantidad("350")).toBe("350");
  });

  it("deja pasar los medios", () => {
    expect(sanitizeCantidad("1.5")).toBe("1.5");
    expect(sanitizeCantidad("0.5")).toBe("0.5");
    expect(sanitizeCantidad("2.5")).toBe("2.5");
  });

  it("conserva el punto mientras se teclea el medio", () => {
    expect(sanitizeCantidad("1.")).toBe("1.");
  });

  it("recorta decimales mayores a un digito", () => {
    expect(sanitizeCantidad("1.50")).toBe("1.5");
  });

  it("rechaza decimales distintos de .5", () => {
    expect(sanitizeCantidad("1.3")).toBe("1");
    expect(sanitizeCantidad("0.001")).toBe("0");
    expect(sanitizeCantidad("2.75")).toBe("2");
  });

  it("rechaza negativos", () => {
    expect(sanitizeCantidad("-3")).toBe("3");
    expect(sanitizeCantidad("-")).toBe("");
  });

  it("rechaza letras y signos", () => {
    expect(sanitizeCantidad("abc")).toBe("");
    expect(sanitizeCantidad("1e5")).toBe("15");
  });

  it("acepta la coma como separador decimal", () => {
    expect(sanitizeCantidad("1,5")).toBe("1.5");
    expect(sanitizeCantidad("1,3")).toBe("1");
  });

  it("acepta vacio y no deja cantidades sin parte entera", () => {
    expect(sanitizeCantidad("")).toBe("");
    expect(sanitizeCantidad(".5")).toBe("");
    expect(sanitizeCantidad("..5")).toBe("");
  });
});

describe("stepCantidad", () => {
  it("arranca en 1 cuando el campo está vacío", () => {
    expect(stepCantidad("", 1)).toBe("1");
    expect(stepCantidad("", -1)).toBe("1");
  });

  it("arranca en 1 si lo que hay no es un número usable", () => {
    expect(stepCantidad("abc", 1)).toBe("1");
    expect(stepCantidad("-2", 1)).toBe("1");
  });

  it("sube y baja en medios", () => {
    expect(stepCantidad("1", 1)).toBe("1.5");
    expect(stepCantidad("1.5", 1)).toBe("2");
    expect(stepCantidad("2", -1)).toBe("1.5");
    expect(stepCantidad("1.5", -1)).toBe("1");
  });

  it("nunca baja de medio", () => {
    expect(stepCantidad("0.5", -1)).toBe("0.5");
  });

  it("redondea a medios aunque le llegue un decimal raro", () => {
    expect(stepCantidad("1.3", 1)).toBe("2");
    expect(stepCantidad("1.8", 1)).toBe("2.5");
    expect(stepCantidad("1.3", -1)).toBe("1");
  });
});
