import {
  ETIQUETAS_TIPO_CLIENTE,
  TIPOS_CLIENTE,
  esTipoCliente,
  etiquetaTipoCliente,
} from "@/lib/tipos-cliente";

describe("tipos de cliente", () => {
  it("expone el catálogo MINORISTA/MAYORISTA/EMPRESA/GOBIERNO", () => {
    expect([...TIPOS_CLIENTE]).toEqual(["MINORISTA", "MAYORISTA", "EMPRESA", "GOBIERNO"]);
    expect(Object.keys(ETIQUETAS_TIPO_CLIENTE)).toEqual([...TIPOS_CLIENTE]);
  });

  it.each([
    ["MINORISTA", true],
    ["MAYORISTA", true],
    ["EMPRESA", true],
    ["GOBIERNO", true],
    ["OTRO", false],
    ["Empresa", false],
    ["", false],
    [null, false],
    [undefined, false],
    [42, false],
  ])("esTipoCliente(%p) -> %p", (valor, esperado) => {
    expect(esTipoCliente(valor)).toBe(esperado);
  });

  it("etiquetaTipoCliente capitaliza los tipos conocidos y deja el resto tal cual", () => {
    expect(etiquetaTipoCliente("MINORISTA")).toBe("Minorista");
    expect(etiquetaTipoCliente("EMPRESA")).toBe("Empresa");
    expect(etiquetaTipoCliente("GOBIERNO")).toBe("Gobierno");
    expect(etiquetaTipoCliente("RARO")).toBe("RARO");
    expect(etiquetaTipoCliente(null)).toBe("");
  });
});
