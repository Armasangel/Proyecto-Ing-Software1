import { normalizarUnidad, presentacionesIniciales, sugerenciasPresentaciones, validarPresentaciones } from "@/lib/presentaciones";

describe("Presentations and base units", () => {
  it.each(["LIBRA", "libras", "lb", "lbs", " libra "])("normalizes %s and supplies the requested weight conversions", (unidad) => {
    expect(normalizarUnidad(unidad)).toBe("libra");
    expect(presentacionesIniciales(unidad).map((p) => p.factor_conversion)).toEqual([1, 25, 50, 100]);
  });

  it("distinguishes millilitres and litres and handles accents", () => {
    expect(normalizarUnidad("GALÓN")).toBe("galon");
    expect(sugerenciasPresentaciones("ml")).toEqual([]);
    expect(sugerenciasPresentaciones("lt")).toEqual([]);
    expect(sugerenciasPresentaciones("botella")).toContainEqual({ nombre_presentacion: "Caja de 24 botellas", factor_conversion: 24 });
    expect(presentacionesIniciales("unidad")).toEqual([{ nombre_presentacion: "Unidad", factor_conversion: 1 }]);
  });

  it("gives unknown units a safe factor of one instead of assuming a package size", () => {
    expect(presentacionesIniciales("rollo")).toEqual([{ nombre_presentacion: "rollo", factor_conversion: 1 }]);
    expect(presentacionesIniciales("")).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity, 0.0001, 1.2345, 1000000000])("rejects factors that cannot be stored losslessly: %s", (factor_conversion) => {
    expect(validarPresentaciones([{ nombre_presentacion: "Bolsa", factor_conversion }])).not.toBeNull();
  });

  it("accepts exact three-decimal conversions and rejects normalized duplicate names", () => {
    expect(validarPresentaciones([{ nombre_presentacion: "Bolsa", factor_conversion: 0.125 }])).toBeNull();
    expect(validarPresentaciones([{ nombre_presentacion: "Cajón", factor_conversion: 2 }, { nombre_presentacion: " cajon ", factor_conversion: 3 }])).toContain("repetir");
  });
});
