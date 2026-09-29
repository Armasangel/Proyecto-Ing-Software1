import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlobalError from "@/app/global-error";
import { logClientError } from "@/lib/client-logger";

jest.mock("@/lib/client-logger", () => ({
  logClientError: jest.fn(),
}));

const mockLogClientError = logClientError as jest.Mock;

// React 19 no mete <html>, <head> ni <body> dentro del container de RTL: los
// aplica al documento real, que es exactamente el comportamiento que este
// archivo necesita (reemplaza el root layout). Por eso las aserciones van
// contra document.* y no contra `container`.
//
// El único costo es que React avisa por consola que no se puede anidar <html>
// adentro de un <div>. Se filtra para no dejar ruido: una suite que ensucia la
// salida entrena a ignorar los warnings que sí importan.
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
  render(<GlobalError error={error} reset={reset} />);
  return { reset, error };
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

  it("aplica su propio lang al documento porque reemplaza el root layout", () => {
    renderConError();

    expect(document.documentElement).toHaveAttribute("lang", "es");
  });

  it("muestra la pantalla de error en el body", () => {
    renderConError();

    expect(document.body.textContent).toContain("El sistema no pudo arrancar");
  });

  it("re-declara las fuentes del sistema, que el layout reemplazado ya no aporta", () => {
    renderConError();

    // Sin estos links la pantalla de error pierde Syne / DM Sans y renderiza
    // con la tipografía por defecto del navegador.
    const fuentes = document.head.querySelectorAll(
      'link[href*="fonts.googleapis.com"]'
    );
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
