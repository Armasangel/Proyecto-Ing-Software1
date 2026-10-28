import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

import { FormularioCliente } from "@/components/clientes/FormularioCliente";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("FormularioCliente", () => {
  it("crea el cliente en la variante de página y muestra la confirmación", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      rest.post("/api/clientes", async (req, res, ctx) => {
        body = (await req.json()) as Record<string, unknown>;
        return res(
          ctx.status(201),
          ctx.json({
            cliente: {
              id_cliente: 8,
              nombre: "Ana López",
              correo: "ana@cliente.com",
              tipo_cliente: "MINORISTA",
            },
          })
        );
      })
    );
    const user = userEvent.setup();
    render(<FormularioCliente />);

    await user.type(screen.getByLabelText(/^Nombre/), "Ana López");
    await user.type(screen.getByLabelText(/^Correo/), "ana@cliente.com");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));

    expect(await screen.findByText("Cliente «Ana López» creado.")).toBeInTheDocument();
    expect(body).toMatchObject({
      nombre: "Ana López",
      correo: "ana@cliente.com",
      tipo_cliente: "MINORISTA",
    });
  });

  it("en la variante inline llama a onCreado con el saldo anterior y sin enviarlo al API", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      rest.post("/api/clientes", async (req, res, ctx) => {
        body = (await req.json()) as Record<string, unknown>;
        return res(
          ctx.status(201),
          ctx.json({
            cliente: {
              id_cliente: 9,
              nombre: "Pedro Nuevo",
              correo: "",
              tipo_cliente: "MINORISTA",
              telefono: null,
            },
          })
        );
      })
    );
    const onCreado = jest.fn();
    const user = userEvent.setup();
    render(
      <FormularioCliente
        variant="inline"
        incluirSaldoAnterior
        onCreado={onCreado}
        onCancelar={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Nombre del cliente"), "Pedro Nuevo");
    await user.type(screen.getByLabelText("Saldo anterior"), "350.50");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));

    await waitFor(() => expect(onCreado).toHaveBeenCalledTimes(1));
    expect(onCreado).toHaveBeenCalledWith(
      expect.objectContaining({ id_cliente: 9, nombre: "Pedro Nuevo" }),
      { deudaInicial: 350.5 }
    );
    expect(body).toMatchObject({ nombre: "Pedro Nuevo", correo: "" });
    expect(body).not.toHaveProperty("deuda_inicial");
  });

  it("mantiene el formulario abierto y muestra el error del servidor", async () => {
    server.use(
      rest.post("/api/clientes", (_req, res, ctx) =>
        res(ctx.status(409), ctx.json({ error: "El correo ya está registrado" }))
      )
    );
    const user = userEvent.setup();
    render(<FormularioCliente />);

    await user.type(screen.getByLabelText(/^Nombre/), "Ana López");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));

    expect(await screen.findByText("El correo ya está registrado")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Ana López");
  });
});
