import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import UsuariosPage from "@/app/usuarios/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const yo = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };

const u = (id: number, nombre: string, tipo: string, activo = true) => ({
  id_usuario: id, nombre, correo: `${nombre.split(" ")[0].toLowerCase()}@tienda.com`, telefono: null,
  tipo_usuario: tipo, estado_usuario: activo, id_bodega: null, requiere_2fa: true, nombre_bodega: null,
});

const conUnDueno = [u(1, "Juan Pérez", "DUENO"), u(2, "María López", "EMPLEADO"), u(3, "Carlos Ruiz", "BODEGUERO")];
const conDosDuenos = [u(1, "Juan Pérez", "DUENO"), u(4, "Ana Gómez", "DUENO"), u(2, "María López", "EMPLEADO"), u(3, "Carlos Ruiz", "BODEGUERO")];

type Respuesta = { usuarios: unknown[]; totales_por_tipo: Record<string, number>; cupos_dueno: { usados: number; maximo: number; disponibles: number } };

const respuesta = (usuarios: unknown[], duenos: number, otros = { EMPLEADO: 1, BODEGUERO: 1 }): Respuesta => ({
  usuarios,
  totales_por_tipo: { DUENO: duenos, ...otros },
  cupos_dueno: { usados: duenos, maximo: 2, disponibles: Math.max(0, 2 - duenos) },
});

function setup(datos: Respuesta) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: yo }))),
    rest.get("/api/usuarios", (_req, res, ctx) => res(ctx.json(datos))),
    rest.get("/api/bodegas/simple", (_req, res, ctx) => res(ctx.json([]))),
  );
}

describe("Usuarios: cupos de dueño", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/usuarios");
  });

  it("con 1 dueño muestra cuántos cupos quedan y deja el botón 👑", async () => {
    setup(respuesta(conUnDueno, 1));
    render(<UsuariosPage />);

    expect(await screen.findByTestId("cupos-dueno")).toHaveTextContent("1 de 2 cupos de dueño disponibles");
    // María y Carlos pueden promoverse; Juan ya es dueño
    expect(screen.getAllByText("👑")).toHaveLength(2);
  });

  it("con el cupo lleno avisa una sola vez y ya no muestra ningún 👑", async () => {
    setup(respuesta(conDosDuenos, 2));
    render(<UsuariosPage />);

    expect(await screen.findByTestId("cupos-dueno")).toHaveTextContent("Sin cupos de dueño (2 de 2 en uso)");
    expect(screen.queryAllByText("👑")).toHaveLength(0);
  });

  it("un usuario inactivo conserva el 👑 deshabilitado mientras haya cupo", async () => {
    setup(respuesta([u(1, "Juan Pérez", "DUENO"), u(2, "María López", "EMPLEADO", false)], 1));
    render(<UsuariosPage />);

    const corona = await screen.findByText("👑");
    expect(corona).toBeDisabled();
    expect(corona).toHaveAttribute("title", "No se puede promover a un usuario inactivo");
  });

  it("los cupos no cambian al filtrar: la lista sin dueños no habilita el 👑", async () => {
    // Filtro por Colaborador: la lista no trae dueños, pero el servidor sabe que ya hay 2
    setup(respuesta([u(2, "María López", "EMPLEADO")], 2, { EMPLEADO: 1, BODEGUERO: 1 }));
    render(<UsuariosPage />);

    expect(await screen.findByTestId("cupos-dueno")).toHaveTextContent("Sin cupos de dueño (2 de 2 en uso)");
    expect(screen.queryAllByText("👑")).toHaveLength(0);
  });

  it("las tarjetas de resumen usan los totales reales, no lo que hay en la lista filtrada", async () => {
    setup(respuesta([u(2, "María López", "EMPLEADO")], 2, { EMPLEADO: 5, BODEGUERO: 3 }));
    render(<UsuariosPage />);
    await screen.findByTestId("cupos-dueno");

    for (const total of ["2", "5", "3"]) {
      expect(screen.getAllByText(total).length).toBeGreaterThan(0);
    }
  });

  it("el modal de nuevo usuario explica los cupos que quedan", async () => {
    setup(respuesta(conUnDueno, 1));
    const user = userEvent.setup();
    render(<UsuariosPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuevo usuario" }));

    const nota = await screen.findByTestId("nota-cupos-dueno");
    expect(nota).toHaveTextContent("1 de 2 cupos de dueño disponibles");
    expect(nota).toHaveTextContent("usa el botón 👑 de la tabla");
  });

  it("el modal de nuevo usuario avisa cuando el cupo está lleno", async () => {
    setup(respuesta(conDosDuenos, 2));
    const user = userEvent.setup();
    render(<UsuariosPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuevo usuario" }));

    const nota = await screen.findByTestId("nota-cupos-dueno");
    expect(nota).toHaveTextContent("Sin cupos de dueño (2 de 2 en uso)");
    expect(nota).toHaveTextContent("primero hay que quitárselo a uno de los actuales");
  });
});
