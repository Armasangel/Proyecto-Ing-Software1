import { NextRequest } from "next/server";
import { POST } from "@/app/api/recuperar/solicitar/route";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { enviarCodigoRecuperacion } from "@/lib/mailer";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("@/lib/api-rate-limit", () => ({
  ...jest.requireActual("@/lib/api-rate-limit"),
  checkRateLimit: jest.fn(),
}));

jest.mock("@/lib/mailer", () => ({
  enviarCodigoRecuperacion: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeReq(body: unknown, ip = "203.0.113.10") {
  return new NextRequest(new URL("/api/recuperar/solicitar", "http://localhost"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function permitirConteo() {
  mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 3 });
}

describe("POST /api/recuperar/solicitar (paso 1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permitirConteo();
  });

  it("returns 400 when correo is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("returns a generic 200 (same message) when the email is not registered, without sending email", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // SELECT usuario
    const res = await POST(makeReq({ correo: "nadie@tienda.com" }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(String(data.message).toLowerCase()).toContain("si el correo está registrado");
    // No se insertó ningún código ni se envió correo.
    expect(mockPool.query.mock.calls.length).toBe(1);
    expect(enviarCodigoRecuperacion).not.toHaveBeenCalled();
  });

  it("inserts a hashed code and sends the email when the account exists", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_usuario: 1, correo: "dueno@tienda.com" }] });
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT codigo_recuperacion
    (enviarCodigoRecuperacion as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await POST(makeReq({ correo: "dueno@tienda.com" }));

    expect(res.status).toBe(200);
    expect(mockPool.query.mock.calls.length).toBe(2);
    const insertSql = mockPool.query.mock.calls[1][0] as string;
    expect(insertSql).toMatch(/INSERT INTO codigo_recuperacion/);
    expect(enviarCodigoRecuperacion).toHaveBeenCalledWith("dueno@tienda.com", expect.stringMatching(/^\d{6}$/));
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 120, restantes: 0 });
    const res = await POST(makeReq({ correo: "dueno@tienda.com" }));
    expect(res.status).toBe(429);
  });

  it("returns generic 200 even if the email fails to send (no error leaked)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_usuario: 1, correo: "dueno@tienda.com" }] });
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    (enviarCodigoRecuperacion as jest.Mock).mockRejectedValueOnce(new Error("smtp down"));

    const res = await POST(makeReq({ correo: "dueno@tienda.com" }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(String(data.message).toLowerCase()).not.toContain("smtp");
  });
});