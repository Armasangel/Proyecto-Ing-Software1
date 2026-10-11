import { ETIQUETAS_EVENTO, registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("lib/audit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserta un evento con todos sus campos", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    await registrarAuditoria({
      id_usuario: 7,
      correo: "juan@tienda.com",
      tipo_evento: TIPOS_EVENTO.LOGIN_OK,
      ip: "203.0.113.9",
      user_agent: "Mozilla/5.0",
      detalle: { con_2fa: true },
    });

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO auditoria");
    expect(params).toEqual([
      7,
      "juan@tienda.com",
      "LOGIN_OK",
      "203.0.113.9",
      "Mozilla/5.0",
      JSON.stringify({ con_2fa: true }),
    ]);
  });

  it("guarda `detalle` como JSON serializado, no como [object Object]", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    await registrarAuditoria({
      tipo_evento: TIPOS_EVENTO.ROL_CAMBIADO,
      detalle: { tipo_usuario: { antes: "EMPLEADO", despues: "BODEGUERO" } },
    });

    const detalle = mockPool.query.mock.calls[0][1][5] as string;
    expect(typeof detalle).toBe("string");
    expect(JSON.parse(detalle)).toEqual({
      tipo_usuario: { antes: "EMPLEADO", despues: "BODEGUERO" },
    });
  });

  it("acepta eventos sin id_usuario (correo que no existe en el sistema)", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    await registrarAuditoria({
      correo: "nadie@tienda.com",
      tipo_evento: TIPOS_EVENTO.LOGIN_FALLIDO,
    });

    // id_usuario NULL pero el correo conservado: el rastro de qué cuenta se
    // estaba atacando tiene que sobrevivir aunque nunca haya existido.
    expect(mockPool.query.mock.calls[0][1][0]).toBeNull();
    expect(mockPool.query.mock.calls[0][1][1]).toBe("nadie@tienda.com");
  });

  it("rellena detalle y user_agent ausentes con valores neutros", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    await registrarAuditoria({ tipo_evento: TIPOS_EVENTO.LOGOUT });

    const params = mockPool.query.mock.calls[0][1];
    expect(params[4]).toBeNull();
    expect(params[5]).toBe("{}");
  });

  it("recorta un User-Agent desmedido", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    const enorme = "x".repeat(1000);
    await registrarAuditoria({
      tipo_evento: TIPOS_EVENTO.LOGIN_OK,
      user_agent: enorme,
    });

    const ua = mockPool.query.mock.calls[0][1][4] as string;
    expect(ua.length).toBeLessThan(310);
    expect(ua.endsWith("…")).toBe(true);
  });

  it("NUNCA propaga el error de base: una bitácora caída no rompe el login", async () => {
    // Ésta es la propiedad más importante del módulo: si el INSERT falla, el
    // flujo de autenticación tiene que continuar igual.
    mockPool.query.mockRejectedValue(new Error("auditoria no disponible"));

    await expect(
      registrarAuditoria({ tipo_evento: TIPOS_EVENTO.LOGIN_OK })
    ).resolves.toBeUndefined();
  });

  it("todo evento de credenciales tiene etiqueta legible", () => {
    for (const valor of Object.values(TIPOS_EVENTO)) {
      expect(ETIQUETAS_EVENTO[valor]).toBeTruthy();
    }
  });
});