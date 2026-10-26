import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import DescuentosPage from "@/app/descuentos/page";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

const mockUsuarioDueno = {
  id_usuario: 1,
  nombre: "Juan Pérez",
  correo: "juan@tienda.com",
  tipo_usuario: "DUENO",
};

const descuentoBase = (overrides: Record<string, unknown> = {}) => ({
  id_descuento: 1,
  nombre: "Mayoreo",
  tipo: "ESCALA",
  activo: true,
  tramos: [
    { id_tramo: 1, cantidad_desde: "1", porcentaje: "5" },
    { id_tramo: 2, cantidad_desde: "10", porcentaje: "10" },
  ],
  asignaciones: [
    { id_asignacion: 3, id_descuento: 1, id_cliente: 5, tipo_cliente: null, nombre_cliente: "Pedro Díaz" },
  ],
  ...overrides,
});

function setupBase(descuentos: unknown[] = [descuentoBase()]) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/descuentos", (_req, res, ctx) => res(ctx.json({ descuentos }))),
    rest.get("/api/clientes", (_req, res, ctx) =>
      res(ctx.json({ clientes: [{ id_cliente: 5, nombre: "Pedro Díaz", tipo_cliente: "MINORISTA" }] }))
    )
  );
}

describe("DescuentosPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/descuentos");
  });

  it("renders reglas and their tramos and asignaciones", async () => {
    setupBase();
    render(<DescuentosPage />);

    expect(await screen.findByText("Mayoreo")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText(/Por escala/)).toBeInTheDocument();
    expect(screen.getByText("1+ u. → 5%")).toBeInTheDocument();
    expect(screen.getByText("10+ u. → 10%")).toBeInTheDocument();
    expect(screen.getByText(/Cliente: Pedro Díaz/)).toBeInTheDocument();
  });

  it("toggles a regla and removes an asignación through the nested routes", async () => {
    setupBase();
    let patchBody: unknown = null;
    let deleteIdAsignacion: string | null = null;
    server.use(
      rest.patch("/api/descuentos/1", async (req, res, ctx) => {
        patchBody = await req.json();
        return res(ctx.json({ ok: true }));
      }),
      rest.delete("/api/descuentos/1/asignaciones", (req, res, ctx) => {
        deleteIdAsignacion = new URL(req.url).searchParams.get("id_asignacion");
        return res(ctx.json({ ok: true }));
      })
    );
    const user = userEvent.setup();
    render(<DescuentosPage />);

    await user.click(await screen.findByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(patchBody).toEqual({ activo: false }));
    expect(await screen.findByText("Descuento desactivado.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar asignación" }));
    await waitFor(() => expect(deleteIdAsignacion).toBe("3"));
  });

  it("creates a regla and assigns it to a cliente", async () => {
    setupBase();
    let postDescuento: unknown = null;
    let postAsignacion: unknown = null;
    let asignacionUrl = "";
    server.use(
      rest.post("/api/descuentos", async (req, res, ctx) => {
        postDescuento = await req.json();
        return res(ctx.status(201), ctx.json({ id_descuento: 2 }));
      }),
      rest.post("/api/descuentos/1/asignaciones", async (req, res, ctx) => {
        postAsignacion = await req.json();
        asignacionUrl = req.url.toString();
        return res(ctx.status(201), ctx.json({ id_asignacion: 9 }));
      })
    );
    const user = userEvent.setup();
    render(<DescuentosPage />);

    await user.click(await screen.findByRole("button", { name: "+ Nuevo descuento" }));
    await user.type(screen.getByLabelText("Nombre del descuento"), "Descuento nuevo");
    await user.type(screen.getByLabelText("Porcentaje"), "7");
    await user.click(screen.getByRole("button", { name: "Guardar descuento" }));

    await waitFor(() =>
      expect(postDescuento).toEqual({
        nombre: "Descuento nuevo",
        tipo: "PORCENTAJE",
        tramos: [{ cantidad_desde: 0, porcentaje: 7 }],
      })
    );
    expect(await screen.findByText("Descuento creado.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Asignar a cliente/tipo" }));
    await user.selectOptions(screen.getByLabelText("Cliente"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar asignación" }));

    await waitFor(() => expect(postAsignacion).toEqual({ id_cliente: 5 }));
    expect(asignacionUrl).toContain("/api/descuentos/1/asignaciones");
    expect(await screen.findByText("Asignación guardada.")).toBeInTheDocument();
  });
});
