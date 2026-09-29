import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlobalError from "@/app/global-error";
import { logClientError } from "@/lib/client-logger";

jest.mock("@/lib/client-logger", () => ({
  logClientError: jest.fn(),
}));

const mockLogClientError = logClientError as jest.Mock;

// Next.js reemplaza el root layout cuando renderiza global-error, así que este
// componente emite sus propios <html>/<head>/<body> adentro del <div> que usa
// RTL. React avisa por consola de eso; el aviso no es sobre nuestra app, así que
// se filtra en vez de dejarlo ensuciar la salida de la suite.
let consoleSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (typeof args[0] === "string" && args[0].includes("validateDOMNesting")) return;
  });
});

afterEach(() => consoleSpy.mockRestore());

function renderConError(digest?: string) {
  const error = Object.assign(new Error("falló el layout"), { digest });
  const reset = jest.fn();
  const { container } = render(<GlobalError error={error} reset={reset} />);
  return { reset, container };
}

describe("app/global-error.tsx (frontera de error del layout raíz)", () => {
  it("registra el error con un mensaje propio del layout", () => {
    const { error } = renderConError("abc123");

    expect(mockLogClientError).toHaveBeenCalledTimes(1);
    expect(mockLogClientError).toHaveBeenCalledWith(
      "Error en el layout raíz",
      error,
      { digest: "abc123" }
    );
  });

  it("declara su propio <html lang='es'> porque reemplaza el root layout", () => {
    const { container } = renderConError();

    const html = container.querySelector("html")!;
    expect(html).toHaveAttribute("lang", "es");
    expect(container.querySelector("body")).not.toBeNull();
  });

  it("re-declara las fuentes del sistema, que el layout reemplazado ya no aporta", () => {
    const { container } = renderConError();

    // Sin estos links la pantalla de error pierde Syne / DM Sans y renderiza
    // con la tipografía por defecto del navegador.
    const fuentes = container.querySelectorAll('link[href*="fonts.googleapis.com"]');
    expect(fuentes.length).toBeGreaterThan(0);
  });

  it("el botón Reintentar llama a reset", async () => {
    const user = userEvent.setup();
    const { reset } = renderConError();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("usa un mensaje acorde a una caída total, no a un error de página", () => {
    renderConError();

    expect(screen.getByRole("heading", { name: /no pudo arrancar/ })).toBeInTheDocument();
  });
});
