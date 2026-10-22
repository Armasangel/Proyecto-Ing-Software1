import {
  ETIQUETAS_TIPO_DOCUMENTO,
  PREFIJOS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO,
  esTipoDocumento,
  etiquetaTipoDocumento,
  prefijoTipoDocumento,
} from "@/lib/tipos-documento";

describe("tipos de documento de facturación", () => {
  it("expone el catálogo FACTURA/FACTURA_CAMBIARIA", () => {
    expect([...TIPOS_DOCUMENTO]).toEqual(["FACTURA", "FACTURA_CAMBIARIA"]);
    expect(Object.keys(ETIQUETAS_TIPO_DOCUMENTO)).toEqual([...TIPOS_DOCUMENTO]);
    expect(Object.keys(PREFIJOS_TIPO_DOCUMENTO)).toEqual([...TIPOS_DOCUMENTO]);
  });

  it.each([
    ["FACTURA", true],
    ["FACTURA_CAMBIARIA", true],
    ["OTRO", false],
    ["factura_cambiaria", false],
    ["", false],
    [null, false],
    [undefined, false],
    [42, false],
  ])("esTipoDocumento(%p) -> %p", (valor, esperado) => {
    expect(esTipoDocumento(valor)).toBe(esperado);
  });

  it("devuelve la etiqueta y el prefijo de cada tipo", () => {
    expect(etiquetaTipoDocumento("FACTURA")).toBe("Factura");
    expect(etiquetaTipoDocumento("FACTURA_CAMBIARIA")).toBe("Factura cambiaria");
    expect(etiquetaTipoDocumento("RARO")).toBe("RARO");
    expect(etiquetaTipoDocumento(null)).toBe("");

    expect(prefijoTipoDocumento("FACTURA")).toBe("FACT");
    expect(prefijoTipoDocumento("FACTURA_CAMBIARIA")).toBe("FCAM");
    expect(prefijoTipoDocumento("RARO")).toBe("FACT");
    expect(prefijoTipoDocumento(null)).toBe("FACT");
  });
});
