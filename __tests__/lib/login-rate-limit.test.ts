import { NextRequest } from "next/server";
import {
  ACCOUNT_LOCKOUT_MAX,
  ACCOUNT_LOCKOUT_WINDOW_MS,
  clearFailedLogins,
  claveCuenta,
  claveIp,
  getClientIp,
  isLoginRateLimited,
  LOGIN_RATE_LIMIT_MAX,
  recordFailedLogin,
  resetLoginRateLimitStore,
} from "@/lib/login-rate-limit";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL("http://localhost/api/login"), { headers });
}

describe("login-rate-limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads IP from x-forwarded-for (first hop)", () => {
    const req = requestWithHeaders({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    });
    expect(getClientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(getClientIp(requestWithHeaders({ "x-real-ip": "198.51.100.1" }))).toBe(
      "198.51.100.1"
    );
    expect(getClientIp(requestWithHeaders({}))).toBe("unknown");
  });

  it("is not limited when there is no row for the clave", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(isLoginRateLimited(claveIp("203.0.113.50"))).resolves.toBe(false);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT bloqueado_hasta FROM login_intento"),
      ["ip:203.0.113.50"]
    );
  });

  it("is limited while bloqueado_hasta is in the future", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ bloqueado_hasta: new Date(Date.now() + 30_000) }],
    });
    await expect(isLoginRateLimited("203.0.113.50")).resolves.toBe(true);
  });

  it("is not limited when the block has expired", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ bloqueado_hasta: new Date(Date.now() - 5_000) }],
    });
    await expect(isLoginRateLimited("203.0.113.50")).resolves.toBe(false);
  });

  it("records failures and blocks after MAX attempts", async () => {
    let intentos = 0;
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO login_intento")) {
        intentos += 1;
        return { rows: [{ intentos }] };
      }
      // Sin bloqueo previo mientras se acumula.
      if (sql.includes("SELECT bloqueado_hasta")) return { rows: [{ bloqueado_hasta: null }] };
      return { rows: [] };
    });

    const clave = claveIp("203.0.113.50");
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      await recordFailedLogin(clave);
    }

    const updateCalls = mockPool.query.mock.calls.filter((call) =>
      (call[0] as string).includes("UPDATE login_intento")
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][1]).toEqual([clave, expect.any(Number)]);
  });

  it("señala el bloqueo sólo en el intento que lo provoca, no en los siguientes", async () => {
    // El aviso por correo se manda una sola vez: si se repitiera en cada
    // intento posterior, un atacante con la contraseña podría usarlo para
    // bombardear la bandeja de la víctima.
    let intentos = 0;
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO login_intento")) {
        intentos += 1;
        return { rows: [{ intentos }] };
      }
      if (sql.includes("SELECT bloqueado_hasta")) {
        const bloqueado = intentos >= LOGIN_RATE_LIMIT_MAX;
        return {
          rows: [
            {
              bloqueado_hasta: bloqueado ? new Date(Date.now() + 30_000) : null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const resultados: boolean[] = [];
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX + 3; i++) {
      resultados.push(await recordFailedLogin(claveIp("203.0.113.50")));
    }

    // Sólo el quinto intento (el que alcanza el máximo) devuelve true.
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(resultados[LOGIN_RATE_LIMIT_MAX - 1]).toBe(true);
    expect(resultados.slice(LOGIN_RATE_LIMIT_MAX)).toEqual([false, false, false]);
  });

  it("el bloqueo por cuenta usa su propia ventana, más larga que la de IP", async () => {
    const intentos: number[] = [];
    mockPool.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes("INSERT INTO login_intento")) {
        intentos.push(params[1] as number);
        return { rows: [{ intentos: intentos.length }] };
      }
      if (sql.includes("SELECT bloqueado_hasta")) return { rows: [{ bloqueado_hasta: null }] };
      return { rows: [] };
    });

    await recordFailedLogin(claveCuenta("Dueño@Tienda.com"), ACCOUNT_LOCKOUT_MAX, ACCOUNT_LOCKOUT_WINDOW_MS);

    expect(intentos[0]).toBe(ACCOUNT_LOCKOUT_WINDOW_MS / 1000);
    expect(ACCOUNT_LOCKOUT_WINDOW_MS).toBeGreaterThan(LOGIN_RATE_LIMIT_MAX * 1000);
  });

  it("normaliza el correo para que el bloqueo no se evada con mayúsculas", () => {
    // El login busca con LOWER(correo) = LOWER($1): si la clave no se
    // normalizara, Usuario@x.com y usuario@x.com serían dos cuentas
    // distintas y el bloqueo se esquivaría cambiando mayúsculas.
    expect(claveCuenta("  Dueño@Tienda.COM  ")).toBe(claveCuenta("dueño@tienda.com"));
    expect(claveCuenta("a@b.com")).not.toBe(claveIp("1.2.3.4"));
  });

  it("clears failures for an IP", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await clearFailedLogins("203.0.113.60");
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM login_intento"),
      ["203.0.113.60"]
    );
  });

  it("resetLoginRateLimitStore truncates the table", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await resetLoginRateLimitStore();
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("TRUNCATE TABLE login_intento")
    );
  });
});
