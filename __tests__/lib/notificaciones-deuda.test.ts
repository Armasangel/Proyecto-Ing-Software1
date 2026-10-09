import {
  actualizarConfiguracion,
  clientesPendientesDeNotificacion,
  ejecutarNotificacionesDeuda,
  obtenerConfiguracion,
} from "@/lib/notificaciones-deuda";
import { enviarRecordatorioDeuda } from "@/lib/mailer";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("@/lib/mailer", () => ({
  enviarRecordatorioDeuda: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockMailer = enviarRecordatorioDeuda as jest.MockedFunction<typeof enviarRecordatorioDeuda>;

const configFila = {
  activo: true,
  intervalo_dias: 7,
  actualizado_en: "2026-09-01T00:00:00.000Z",
  actualizado_por: 1,
};

const clienteA = {
  id_cliente: 1,
  nombre: "Carlos Ruiz",
  correo: "carlos@email.com",
  monto_pendiente: 150.5,
  cantidad_deudas: 2,
  proxima_fecha_limite: "2026-10-01",
};

const clienteB = {
  id_cliente: 2,
  nombre: "Distribuidora El Sol",
  correo: "sol@email.com",
  monto_pendiente: 900,
  cantidad_deudas: 1,
  proxima_fecha_limite: null,
};

describe("obtenerConfiguracion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the stored row", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [configFila] });
    const config = await obtenerConfiguracion();
    expect(config).toEqual(configFila);
  });

  it("falls back to a safe default (off) when the row is missing", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const config = await obtenerConfiguracion();
    expect(config.activo).toBe(false);
    expect(config.intervalo_dias).toBe(7);
  });
});

describe("actualizarConfiguracion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("merges partial changes with the current config", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [configFila] }) // obtenerConfiguracion (lectura previa)
      .mockResolvedValueOnce({ rows: [{ ...configFila, intervalo_dias: 14 }] }); // UPDATE

    const result = await actualizarConfiguracion({ intervalo_dias: 14 }, 5);
    expect(result.intervalo_dias).toBe(14);

    const updateCall = mockPool.query.mock.calls[1];
    expect((updateCall[0] as string)).toContain("UPDATE configuracion_notificaciones_deuda");
    // activo se mantiene el actual (true) porque no vino en los cambios.
    expect(updateCall[1]).toEqual([true, 14, 5]);
  });
});

describe("clientesPendientesDeNotificacion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes intervaloDias as a query param and returns the rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [clienteB, clienteA] });
    const result = await clientesPendientesDeNotificacion(10);
    expect(result).toEqual([clienteB, clienteA]);
    expect(mockPool.query.mock.calls[0][1]).toEqual([10]);
  });
});

describe("ejecutarNotificacionesDeuda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMailer.mockResolvedValue(undefined);
  });

  it("does nothing when the config is inactive", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...configFila, activo: false }] });
    const resumen = await ejecutarNotificacionesDeuda();
    expect(resumen).toEqual({ activo: false, procesados: 0, enviados: 0, fallidos: 0 });
    expect(mockMailer).not.toHaveBeenCalled();
    // Ni siquiera debería haber consultado a qué clientes les toca.
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it("emails every due client and logs each successful send", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [configFila] }) // obtenerConfiguracion
      .mockResolvedValueOnce({ rows: [clienteA, clienteB] }) // clientesPendientesDeNotificacion
      .mockResolvedValueOnce({ rows: [] }) // INSERT notificacion_deuda (clienteA)
      .mockResolvedValueOnce({ rows: [] }); // INSERT notificacion_deuda (clienteB)

    const resumen = await ejecutarNotificacionesDeuda();

    expect(resumen).toEqual({ activo: true, procesados: 2, enviados: 2, fallidos: 0 });
    expect(mockMailer).toHaveBeenCalledWith("carlos@email.com", "Carlos Ruiz", 150.5, 2, "2026-10-01");
    expect(mockMailer).toHaveBeenCalledWith("sol@email.com", "Distribuidora El Sol", 900, 1, null);

    const inserts = mockPool.query.mock.calls.filter((c) => (c[0] as string).includes("INSERT INTO notificacion_deuda"));
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1]).toEqual([1, 150.5, 2]);
  });

  it("keeps going and counts a failure when one client's email fails", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [configFila] })
      .mockResolvedValueOnce({ rows: [clienteA, clienteB] })
      .mockResolvedValueOnce({ rows: [] }); // solo un INSERT: el del que sí funciona

    mockMailer.mockRejectedValueOnce(new Error("correo inválido")).mockResolvedValueOnce(undefined);

    const resumen = await ejecutarNotificacionesDeuda();

    expect(resumen).toEqual({ activo: true, procesados: 2, enviados: 1, fallidos: 1 });
    const inserts = mockPool.query.mock.calls.filter((c) => (c[0] as string).includes("INSERT INTO notificacion_deuda"));
    // Solo se registra la notificación del cliente al que sí se le pudo enviar.
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual([2, 900, 1]);
  });
});
