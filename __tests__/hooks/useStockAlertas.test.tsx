import { renderHook, waitFor, act } from "@testing-library/react";
import { rest } from "msw";
import { setupServer } from "msw/node";

import { useStockAlertas } from "@/hooks/useStockAlertas";
import { mockStockMinimoAlertas } from "../mocks/data";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useStockAlertas", () => {
  it("does not poll when disabled (e.g. colaborador)", async () => {
    let hits = 0;
    server.use(
      rest.get("/api/gestion-inventario/stock-minimo", (_req, res, ctx) => {
        hits += 1;
        return res(ctx.json({ alertas: [], total: 0 }));
      })
    );
    const { result } = renderHook(() => useStockAlertas(false));
    expect(result.current.alertas).toEqual([]);
    // dar tiempo a un posible poll accidental
    await new Promise((r) => setTimeout(r, 50));
    expect(hits).toBe(0);
  });

  it("loads current alertas on first poll without emitting toasts", async () => {
    server.use(
      rest.get("/api/gestion-inventario/stock-minimo", (_req, res, ctx) =>
        res(ctx.json({ alertas: mockStockMinimoAlertas, total: mockStockMinimoAlertas.length }))
      )
    );
    const { result } = renderHook(() => useStockAlertas(true));
    await waitFor(() => expect(result.current.alertas).toHaveLength(1));
    // Primer poll: son la línea base, no deben aparecer como "nuevas".
    expect(result.current.nuevas).toHaveLength(0);
  });

  it("emits a nueva alerta only once a product first appears after the baseline", async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    let callCount = 0;
    server.use(
      rest.get("/api/gestion-inventario/stock-minimo", (_req, res, ctx) => {
        callCount += 1;
        // Primera llamada: línea base vacía. Desde la segunda en adelante: ya
        // apareció la alerta. Esto evita depender del timing entre llamadas.
        const alertas = callCount === 1 ? [] : mockStockMinimoAlertas;
        return res(ctx.json({ alertas, total: alertas.length }));
      })
    );

    const { result } = renderHook(() => useStockAlertas(true));
    // Deja resolver el primer poll (llamada directa, no depende del interval).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.alertas).toHaveLength(0);
    expect(result.current.nuevas).toHaveLength(0);

    // Avanza el reloj falso para disparar el siguiente poll del interval.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30000);
    });
    expect(result.current.alertas).toHaveLength(1);
    expect(result.current.nuevas).toHaveLength(1);
    expect(result.current.nuevas[0].id_producto).toBe(mockStockMinimoAlertas[0].id_producto);

    jest.useRealTimers();
  });

  it("descartarNueva removes a toast by product id", async () => {
    server.use(
      rest.get("/api/gestion-inventario/stock-minimo", (_req, res, ctx) =>
        res(ctx.json({ alertas: mockStockMinimoAlertas, total: mockStockMinimoAlertas.length }))
      )
    );
    const { result } = renderHook(() => useStockAlertas(true));
    await waitFor(() => expect(result.current.alertas).toHaveLength(1));

    act(() => {
      result.current.descartarNueva(mockStockMinimoAlertas[0].id_producto);
    });
    expect(result.current.nuevas).toHaveLength(0);
  });
});
