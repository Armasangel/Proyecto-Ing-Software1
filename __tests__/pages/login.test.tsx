import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

import { useRouter } from "next/navigation";
import LoginPage from "@/app/login/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

describe("LoginPage", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it("renders the branding panel", () => {
    render(<LoginPage />);
    expect(screen.getByText("Tienda San Miguel")).toBeInTheDocument();
    expect(screen.getByText("Sistema de gestión")).toBeInTheDocument();
    expect(screen.getByText("Control de inventario en tiempo real")).toBeInTheDocument();
  });

  it("renders the login form", () => {
    render(<LoginPage />);
    expect(screen.getByText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar al sistema/i })).toBeInTheDocument();
  });

  it("shows demo user quick-fill buttons", () => {
    render(<LoginPage />);
    expect(screen.getByText(/Dueño/)).toBeInTheDocument();
    expect(screen.getByText(/Colaborador/)).toBeInTheDocument();
  });

  it("fills email when demo button is clicked", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByText(/Dueño/));
    const emailInput = screen.getByPlaceholderText("usuario@tienda.com") as HTMLInputElement;
    expect(emailInput.value).toBe("dueno@tienda.com");
  });

  it("shows error on failed login", async () => {
    server.use(
      rest.post("/api/login", (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ error: "Credenciales incorrectas" }))
      )
    );
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("usuario@tienda.com"), "test@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: /ingresar al sistema/i }));
    await waitFor(() => {
      expect(screen.getByText("Credenciales incorrectas")).toBeInTheDocument();
    });
  });

  it("redirects to dashboard after successful login and code verification", async () => {
    server.use(
      rest.post("/api/login", (_req, res, ctx) =>
        res(ctx.json({
          ok: true,
          requiere_verificacion: true,
          pre_token: "pre-token-abc",
          correo_enmascarado: "du***@tienda.com",
        }))
      ),
      rest.post("/api/login/verificar-codigo", (_req, res, ctx) =>
        res(ctx.json({
          ok: true,
          token: "abc",
          usuario: { id_usuario: 1, nombre: "Juan", correo: "dueno@tienda.com", tipo_usuario: "DUENO" },
        }))
      )
    );
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("usuario@tienda.com"), "dueno@tienda.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /ingresar al sistema/i }));

    // Paso 2: ahora debe pedir el código de verificación.
    await waitFor(() => {
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("000000"), "123456");
    await user.click(screen.getByRole("button", { name: /verificar y entrar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to /ventas after successful login and code verification for empleado", async () => {
    server.use(
      rest.post("/api/login", (_req, res, ctx) =>
        res(ctx.json({
          ok: true,
          requiere_verificacion: true,
          pre_token: "pre-token-abc",
          correo_enmascarado: "em***@tienda.com",
        }))
      ),
      rest.post("/api/login/verificar-codigo", (_req, res, ctx) =>
        res(ctx.json({
          ok: true,
          token: "abc",
          usuario: { id_usuario: 2, nombre: "María", correo: "empleado@tienda.com", tipo_usuario: "EMPLEADO" },
        }))
      )
    );
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("usuario@tienda.com"), "empleado@tienda.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /ingresar al sistema/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("000000"), "654321");
    await user.click(screen.getByRole("button", { name: /verificar y entrar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/ventas");
    });
  });

  it("shows an error if the verification code is wrong", async () => {
    server.use(
      rest.post("/api/login", (_req, res, ctx) =>
        res(ctx.json({
          ok: true,
          requiere_verificacion: true,
          pre_token: "pre-token-abc",
          correo_enmascarado: "du***@tienda.com",
        }))
      ),
      rest.post("/api/login/verificar-codigo", (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ error: "Código incorrecto" }))
      )
    );
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("usuario@tienda.com"), "dueno@tienda.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /ingresar al sistema/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("000000"), "000000");
    await user.click(screen.getByRole("button", { name: /verificar y entrar/i }));

    await waitFor(() => {
      expect(screen.getByText("Código incorrecto")).toBeInTheDocument();
    });
  });
});