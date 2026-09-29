import { logClientError, serializarError } from "@/lib/client-logger";

describe("serializarError", () => {
  it("normaliza una instancia de Error con name, message y stack", () => {
    const error = new TypeError("no se pudo leer el producto");
    const serializado = serializarError(error);

    expect(serializado.name).toBe("TypeError");
    expect(serializado.message).toBe("no se pudo leer el producto");
    expect(serializado.stack).toBe(error.stack);
  });

  it("usa String() para valores que no son Error", () => {
    // Un error boundary puede recibir cualquier cosa desde `throw "texto"`.
    expect(serializarError("falló el fetch")).toEqual({
      name: "NoError",
      message: "falló el fetch",
    });
  });

  it("no revienta con undefined, null ni objetos planos", () => {
    expect(serializarError(undefined).message).toBe("undefined");
    expect(serializarError(null).message).toBe("null");
    expect(serializarError({ id: 5 }).message).toBe("[object Object]");
  });
});

describe("logClientError", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("escribe en la consola con el prefijo [cliente]", () => {
    logClientError("Error al renderizar la página");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toBe("[cliente] Error al renderizar la página");
  });

  it("adjunta el error serializado bajo la clave err", () => {
    const error = new Error("boom");
    logClientError("Error al renderizar", error);

    expect(consoleSpy.mock.calls[0][1]).toMatchObject({
      err: { name: "Error", message: "boom" },
    });
  });

  it("incluye el digest para correlacionar con el log del servidor", () => {
    // Es el vínculo entre el error de navegador y la línea de pino del
    // servidor: sin esto, el error de cliente no se puede pursuitar.
    logClientError("Error al renderizar", new Error("boom"), {
      digest: "abc123",
      ruta: "/ventas",
    });

    expect(consoleSpy.mock.calls[0][1]).toMatchObject({
      digest: "abc123",
      ruta: "/ventas",
    });
  });

  it("omite la clave err cuando no se pasa error", () => {
    logClientError("Sin error asociado", undefined, { ruta: "/login" });

    expect(consoleSpy.mock.calls[0][1]).toEqual({ ruta: "/login" });
  });

  it("no lanza aunque console.error esté pisado", () => {
    // Un logger que rompe la app es peor que un logger que no reporta.
    consoleSpy.mockImplementation(() => {
      throw new Error("consola rota");
    });

    expect(() =>
      logClientError("Error al renderizar", new Error("boom"), {
        ctx: { anidado: true },
      })
    ).not.toThrow();
  });

  it("no lanza con un contexto no serializable", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => logClientError("Contexto raro", new Error("boom"), circular)).not.toThrow();
  });
});
