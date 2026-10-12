import {
  ApiError,
  api,
  fetchJson,
  getErrorMessage,
  MENSAJE_RESPUESTA_INVALIDA,
  MENSAJE_SIN_CONEXION,
} from "@/lib/api-client";

function respuesta(body: string | null, status = 200) {
  return new Response(body, { status });
}

/** Espera la promesa y devuelve el error que lanzó, ya tipado como ApiError. */
async function capturar(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error("Se esperaba que la promesa fallara");
}

describe("fetchJson", () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("hace GET y devuelve el JSON tipado", async () => {
    fetchMock.mockResolvedValue(respuesta(JSON.stringify({ deudas: [{ id_deuda: 1 }] })));
    const data = await fetchJson<{ deudas: { id_deuda: number }[] }>("/api/deudas");
    expect(data.deudas[0].id_deuda).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/deudas");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("serializa el body a JSON y agrega Content-Type", async () => {
    fetchMock.mockResolvedValue(respuesta("{}", 201));
    await api.post("/api/deudas/1/pagos", { monto: 30, metodo_pago: "EFECTIVO" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ monto: 30, metodo_pago: "EFECTIVO" });
  });

  it("sin body no manda Content-Type ni body (PATCH sin cuerpo)", async () => {
    fetchMock.mockResolvedValue(respuesta("{}"));
    await api.patch("/api/deudas/1");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBeUndefined();
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("usa el método correcto en cada atajo", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(respuesta("{}")));
    await api.get("/x");
    await api.put("/x", {});
    await api.delete("/x");
    expect(fetchMock.mock.calls.map((c) => c[1].method)).toEqual(["GET", "PUT", "DELETE"]);
  });

  it("devuelve null si el cuerpo viene vacío", async () => {
    fetchMock.mockResolvedValue(respuesta(null, 200));
    await expect(fetchJson("/x")).resolves.toBeNull();
  });

  it("lanza ApiError con el mensaje que envía el servidor", async () => {
    fetchMock.mockResolvedValue(respuesta(JSON.stringify({ error: "El pago es mayor al saldo pendiente." }), 400));
    const err = await capturar(fetchJson("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("El pago es mayor al saldo pendiente.");
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: "El pago es mayor al saldo pendiente." });
    expect(err.isNetworkError).toBe(false);
  });

  it("usa fallbackError si el servidor no manda un mensaje", async () => {
    fetchMock.mockResolvedValue(respuesta(JSON.stringify({}), 400));
    const err = await capturar(fetchJson("/x", { fallbackError: "No se pudo guardar." }));
    expect(err.message).toBe("No se pudo guardar.");
  });

  it("sin mensaje ni fallback usa un texto genérico según el status", async () => {
    fetchMock.mockResolvedValueOnce(respuesta(null, 403));
    expect((await capturar(fetchJson("/x"))).message).toMatch(/permiso/);
    fetchMock.mockResolvedValueOnce(respuesta(null, 500));
    expect((await capturar(fetchJson("/x"))).message).toMatch(/servidor/);
    fetchMock.mockResolvedValueOnce(respuesta(null, 418));
    expect((await capturar(fetchJson("/x"))).message).toMatch(/418/);
  });

  it("no revienta si el error no es JSON (ej. HTML de un proxy)", async () => {
    fetchMock.mockResolvedValue(respuesta("<html>Bad gateway</html>", 502));
    const err = await capturar(fetchJson("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
  });

  it("lanza ApiError si una respuesta exitosa no es JSON válido", async () => {
    fetchMock.mockResolvedValue(respuesta("<html>hola</html>", 200));
    const err = await capturar(fetchJson("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe(MENSAJE_RESPUESTA_INVALIDA);
  });

  it("convierte un fallo de red en ApiError con status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const err = await capturar(fetchJson("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.isNetworkError).toBe(true);
    expect(err.message).toBe(MENSAJE_SIN_CONEXION);
  });

  it("deja pasar los AbortError sin disfrazarlos de error de red", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValue(abort);
    await expect(fetchJson("/x")).rejects.toBe(abort);
  });
});

describe("getErrorMessage", () => {
  it("devuelve el mensaje de un ApiError", () => {
    expect(getErrorMessage(new ApiError("Sin permiso", 403))).toBe("Sin permiso");
  });
  it("no filtra mensajes internos de errores que no son ApiError", () => {
    expect(getErrorMessage(new TypeError("Cannot read properties of undefined"), "Falló.")).toBe("Falló.");
    expect(getErrorMessage("algo", "Falló.")).toBe("Falló.");
  });
  it("tiene un fallback por defecto", () => {
    expect(getErrorMessage(null)).toMatch(/inesperado/);
  });
});
