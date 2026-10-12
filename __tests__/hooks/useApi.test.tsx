import { act, renderHook, waitFor } from "@testing-library/react";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { useMutation, useQuery } from "@/hooks/useApi";
import { api } from "@/lib/api-client";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

type Lista = { items: string[] };

describe("useQuery", () => {
  it("carga los datos al montar y pasa de loading a listo", async () => {
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.json({ items: ["a", "b"] }))));
    const { result } = renderHook(() => useQuery<Lista>("/api/lista"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: ["a", "b"] });
    expect(result.current.error).toBe("");
  });

  it("con initialData, data nunca es null", async () => {
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.json({ items: ["x"] }))));
    const { result } = renderHook(() => useQuery<Lista>("/api/lista", { initialData: { items: [] } }));

    expect(result.current.data.items).toEqual([]);
    await waitFor(() => expect(result.current.data.items).toEqual(["x"]));
  });

  it("expone el mensaje de error del servidor y conserva los datos previos", async () => {
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.status(403), ctx.json({ error: "No autorizado" }))));
    const { result } = renderHook(() => useQuery<Lista>("/api/lista", { initialData: { items: ["previo"] } }));

    await waitFor(() => expect(result.current.error).toBe("No autorizado"));
    expect(result.current.loading).toBe(false);
    expect(result.current.data.items).toEqual(["previo"]);
  });

  it("usa errorMessage cuando el servidor no manda uno", async () => {
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.status(500), ctx.text(""))));
    const { result } = renderHook(() => useQuery<Lista>("/api/lista", { errorMessage: "No se pudo cargar la lista." }));
    await waitFor(() => expect(result.current.error).toBe("No se pudo cargar la lista."));
  });

  it("refetch vuelve a pedir los datos", async () => {
    let n = 0;
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.json({ items: [`v${++n}`] }))));
    const { result } = renderHook(() => useQuery<Lista>("/api/lista"));
    await waitFor(() => expect(result.current.data).toEqual({ items: ["v1"] }));

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({ items: ["v2"] });
  });

  it("si hay dos peticiones en vuelo gana la más reciente", async () => {
    let n = 0;
    server.use(
      rest.get("/api/lista", (_req, res, ctx) => {
        const llamada = ++n;
        // la 1.ª (carga inicial) responde tarde; la 2.ª (refetch) responde rápido
        return res(ctx.delay(llamada === 1 ? 150 : 0), ctx.json({ items: [llamada === 1 ? "viejo" : "nuevo"] }));
      })
    );
    const { result } = renderHook(() => useQuery<Lista>("/api/lista"));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({ items: ["nuevo"] });

    await new Promise((r) => setTimeout(r, 250));
    expect(result.current.data).toEqual({ items: ["nuevo"] }); // la respuesta tardía se ignoró
  });

  it("setData actualiza localmente (valor o función)", async () => {
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.json({ items: ["a"] }))));
    const { result } = renderHook(() => useQuery<Lista>("/api/lista", { initialData: { items: [] } }));
    await waitFor(() => expect(result.current.data.items).toEqual(["a"]));

    act(() => result.current.setData((prev) => ({ items: [...prev.items, "b"] })));
    expect(result.current.data.items).toEqual(["a", "b"]);
    act(() => result.current.setData({ items: ["z"] }));
    expect(result.current.data.items).toEqual(["z"]);
  });

  it("con url null no hace ninguna petición", async () => {
    const spy = jest.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useQuery<Lista>(null));
    expect(result.current.loading).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("no actualiza el estado si se desmonta antes de que llegue la respuesta", async () => {
    server.use(rest.get("/api/lista", (_req, res, ctx) => res(ctx.delay(50), ctx.json({ items: ["a"] }))));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderHook(() => useQuery<Lista>("/api/lista"));
    unmount();
    await new Promise((r) => setTimeout(r, 120));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("useMutation", () => {
  it("run devuelve la respuesta y la deja en data", async () => {
    server.use(rest.post("/api/pagos", (_req, res, ctx) => res(ctx.status(201), ctx.json({ ok: true }))));
    const { result } = renderHook(() => useMutation((v: { monto: number }) => api.post<{ ok: boolean }>("/api/pagos", v)));

    let respuesta: { ok: boolean } | undefined;
    await act(async () => {
      respuesta = await result.current.run({ monto: 5 });
    });
    expect(respuesta).toEqual({ ok: true });
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("si falla, run devuelve undefined, nunca lanza y deja el mensaje en error", async () => {
    server.use(rest.post("/api/pagos", (_req, res, ctx) => res(ctx.status(400), ctx.json({ error: "Monto inválido" }))));
    const { result } = renderHook(() => useMutation((v: { monto: number }) => api.post("/api/pagos", v)));

    let respuesta: unknown = "sin-llamar";
    await act(async () => {
      respuesta = await result.current.run({ monto: 0 });
    });
    expect(respuesta).toBeUndefined();
    expect(result.current.error).toBe("Monto inválido");
    expect(result.current.data).toBeNull();
  });

  it("errores que no son ApiError usan errorMessage (no filtran detalles internos)", async () => {
    const { result } = renderHook(() =>
      useMutation(
        async () => {
          throw new TypeError("Cannot read properties of undefined");
        },
        { errorMessage: "No se pudo guardar." }
      )
    );
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe("No se pudo guardar.");
  });

  it("expone loading y las variables de la ejecución en curso", async () => {
    server.use(rest.patch("/api/deudas/7", (_req, res, ctx) => res(ctx.delay(60), ctx.json({ ok: true }))));
    const { result } = renderHook(() => useMutation((id: number) => api.patch(`/api/deudas/${id}`)));

    let promesa!: Promise<unknown>;
    act(() => {
      promesa = result.current.run(7);
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.variables).toBe(7);

    await act(async () => {
      await promesa;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.variables).toBeUndefined();
  });

  it("fail marca un error de validación sin llamar al servidor, y reset lo limpia", () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useMutation(fn));

    act(() => result.current.fail("Falta el nombre"));
    expect(result.current.error).toBe("Falta el nombre");
    expect(result.current.loading).toBe(false);
    expect(fn).not.toHaveBeenCalled();

    act(() => result.current.reset());
    expect(result.current.error).toBe("");
  });

  it("un nuevo run limpia el error anterior", async () => {
    let falla = true;
    const { result } = renderHook(() =>
      useMutation(async () => {
        if (falla) return api.get("/api/no-existe-mutation"); // 404 → error
        return "listo";
      })
    );
    server.use(rest.get("/api/no-existe-mutation", (_req, res, ctx) => res(ctx.status(404), ctx.json({ error: "No existe" }))));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe("No existe");

    falla = false;
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe("");
    expect(result.current.data).toBe("listo");
  });

  it("ejecuta siempre la versión más reciente de la función (closures al día)", async () => {
    const { result, rerender } = renderHook(({ prefijo }) => useMutation(async (n: number) => `${prefijo}${n}`), {
      initialProps: { prefijo: "A" },
    });
    rerender({ prefijo: "B" });
    let r: string | undefined;
    await act(async () => {
      r = await result.current.run(1);
    });
    expect(r).toBe("B1");
  });
});
