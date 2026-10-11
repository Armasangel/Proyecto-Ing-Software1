import {
  esSesionValida,
  registrarAcceso,
  revocarSesiones,
} from "@/lib/sesion";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("lib/sesion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("acepta un token cuya versión coincide y el usuario está habilitado", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ sesion_version: 3, estado_usuario: true }] });

    await expect(esSesionValida(7, 3)).resolves.toBe(true);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("sesion_version"),
      [7]
    );
  });

  it("rechaza un token emitido antes de una revocación", async () => {
    // El usuario cambió su contraseña → sesion_version subió. El token viejo
    // sigue firmado y sin expirar, pero ya no sirve.
    mockPool.query.mockResolvedValue({ rows: [{ sesion_version: 4, estado_usuario: true }] });

    await expect(esSesionValida(7, 3)).resolves.toBe(false);
  });

  it("rechaza a un usuario deshabilitado aunque la versión coincida", async () => {
    // El rol y el estado viajan en el JWT; si sólo se mirara la versión, un
    // empleado dado de baja conservería sus permisos hasta que expirara.
    mockPool.query.mockResolvedValue({ rows: [{ sesion_version: 1, estado_usuario: false }] });

    await expect(esSesionValida(7, 1)).resolves.toBe(false);
  });

  it("rechaza si el usuario ya no existe", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(esSesionValida(999, 1)).resolves.toBe(false);
  });

  it("trata un token sin claim sv como versión 1", async () => {
    // Tolera los tokens emitidos antes de que existiera el claim.
    mockPool.query.mockResolvedValue({ rows: [{ sesion_version: 1, estado_usuario: true }] });
    await expect(esSesionValida(7, undefined)).resolves.toBe(true);
  });

  it("falla cerrado si la base no responde", async () => {
    // Ante un error de base no se concede acceso por omisión: preferimos
    // denegar a dejar pasar tokens potencialmente revocados.
    mockPool.query.mockRejectedValue(new Error("connection refused"));

    await expect(esSesionValida(7, 1)).resolves.toBe(false);
  });

  it("revocarSesiones incrementa la versión", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    await revocarSesiones(7);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("sesion_version = sesion_version + 1"),
      [7]
    );
  });

  it("registrarAcceso deja constancia del último ingreso", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    await registrarAcceso(7, "203.0.113.9");

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("ultimo_login_en = NOW()");
    expect(sql).toContain("ultimo_login_ip = $2");
    expect(params).toEqual([7, "203.0.113.9"]);
  });
});