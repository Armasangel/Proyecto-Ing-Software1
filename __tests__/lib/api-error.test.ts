import { apiError, validationError, unauthorizedError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";

jest.mock("@/lib/logger", () => {
  const mockChild = { error: jest.fn() };
  return {
    logger: { child: jest.fn(() => mockChild) },
    getLogger: jest.fn(() => mockChild),
  };
});

function mockErrorCall(): jest.Mock {
  return (getLogger("api-error") as { error: jest.Mock }).error;
}

describe("apiError", () => {
  beforeEach(() => {
    mockErrorCall().mockClear();
  });

  it("returns 500 with generic error message by default", async () => {
    const res = apiError("TEST", new Error("db failure"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Error interno del servidor" });
  });

  it("does not leak the original error message to the client", async () => {
    const res = apiError("TEST", new Error("secreto: contraseña_en_claro"));
    const body = await res.json();
    expect(body.error).not.toContain("secreto");
    expect(body.error).toBe("Error interno del servidor");
  });

  it("accepts a custom status code", async () => {
    const res = apiError("TEST", "timeout", 502);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "Error interno del servidor" });
  });

  it("works with string errors", async () => {
    const res = apiError("TEST", "algo salió mal");
    expect(res.status).toBe(500);
  });

  it("works with null/undefined errors", async () => {
    const res = apiError("TEST", null);
    expect(res.status).toBe(500);
    const res2 = apiError("TEST", undefined);
    expect(res2.status).toBe(500);
  });

  it("loggea el error completo con su contexto vía pino", () => {
    apiError("MI_CONTEXTO", new Error("test"));
    expect(mockErrorCall()).toHaveBeenCalledWith({ err: expect.any(Error) }, "MI_CONTEXTO");
  });
});

describe("validationError", () => {
  it("returns 400 with the provided message", async () => {
    const res = validationError("Campo obligatorio");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Campo obligatorio" });
  });

  it("preserves the exact message string", async () => {
    const msg = "El nombre del producto debe tener al menos 3 caracteres";
    const res = validationError(msg);
    const body = await res.json();
    expect(body.error).toBe(msg);
  });

  it("works with empty message", async () => {
    const res = validationError("");
    const body = await res.json();
    expect(body.error).toBe("");
  });
});

describe("unauthorizedError", () => {
  it("returns 403 with 'No autorizado'", async () => {
    const res = unauthorizedError();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "No autorizado" });
  });
});
