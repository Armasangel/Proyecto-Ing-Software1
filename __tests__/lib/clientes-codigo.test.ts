import {
  CODIGO_CLIENTE_MAX,
  PREFIJO_CODIGO_CLIENTE,
  errorCodigoCliente,
  esCodigoClienteValido,
  formatearCodigoCliente,
  normalizarCodigoCliente,
} from "@/lib/clientes-codigo";

describe("normalizarCodigoCliente", () => {
  it("recorta y pasa a mayúsculas", () => {
    expect(normalizarCodigoCliente("  cli-12  ")).toBe("CLI-12");
  });

  it("deja vacío lo que no es texto", () => {
    expect(normalizarCodigoCliente(undefined)).toBe("");
    expect(normalizarCodigoCliente(null)).toBe("");
    expect(normalizarCodigoCliente(42)).toBe("");
    expect(normalizarCodigoCliente({})).toBe("");
  });
});

describe("formatearCodigoCliente", () => {
  it("arma el correlativo con prefijo y 5 dígitos", () => {
    expect(formatearCodigoCliente(1)).toBe("CLI-00001");
    expect(formatearCodigoCliente(42)).toBe("CLI-00042");
    expect(formatearCodigoCliente(123456)).toBe("CLI-123456");
  });

  it("usa el prefijo compartido", () => {
    expect(formatearCodigoCliente(7).startsWith(`${PREFIJO_CODIGO_CLIENTE}-`)).toBe(true);
  });
});

describe("esCodigoClienteValido", () => {
  it("acepta letras, números, guion, punto y guion bajo", () => {
    expect(esCodigoClienteValido("CLI-00001")).toBe(true);
    expect(esCodigoClienteValido("A1")).toBe(true);
    expect(esCodigoClienteValido("cliente.1")).toBe(true);
    expect(esCodigoClienteValido("CLIENTE_1")).toBe(true);
  });

  it("rechaza el código vacío (en ese caso lo genera la base)", () => {
    expect(esCodigoClienteValido("")).toBe(false);
  });

  it("rechaza espacios y símbolos", () => {
    expect(esCodigoClienteValido("CLI 12")).toBe(false);
    expect(esCodigoClienteValido("CLI/12")).toBe(false);
    expect(esCodigoClienteValido("-12")).toBe(false);
  });

  it("rechaza códigos más largos que la columna", () => {
    expect(esCodigoClienteValido("X".repeat(CODIGO_CLIENTE_MAX))).toBe(true);
    expect(esCodigoClienteValido("X".repeat(CODIGO_CLIENTE_MAX + 1))).toBe(false);
  });
});

describe("errorCodigoCliente", () => {
  it("no da error con el código vacío (se autogenera)", () => {
    expect(errorCodigoCliente("")).toBeNull();
  });

  it("no da error con un código válido", () => {
    expect(errorCodigoCliente("CLI-00001")).toBeNull();
  });

  it("avisa cuando el código es demasiado largo", () => {
    expect(errorCodigoCliente("X".repeat(CODIGO_CLIENTE_MAX + 1))).toMatch(/20 caracteres/);
  });

  it("avisa cuando el código tiene caracteres no permitidos", () => {
    expect(errorCodigoCliente("CLI 12")).toMatch(/letras, números, guiones, puntos o guiones bajos/);
  });
});
