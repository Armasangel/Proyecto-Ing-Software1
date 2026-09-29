import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RouteError from "@/app/error";
import { logClientError } from "@/lib/client-logger";

jest.mock("@/lib/client-logger", () => ({
  logClientError: jest.fn(),
}));

const mockLogClientError = logClientError as jest.Mock;

function renderConError(mensaje = "falló el render", digest?: string) {
  const error = Object.assign(new Error(mensaje), { digest });
  const reset = jest.fn();
  render(<RouteError error={error} reset={reset} />);
  return { reset, error };
}

describe("app/error.tsx (frontera de error de ruta)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra el error en el logger del cliente", () => {
    const { error } = renderConError("falló el render", "abc123");

    expect(mockLogClientError).toHaveBeenCalledTimes(1);
    expect(mockLogClientError).toHaveBeenCalledWith(
      "Error al renderizar la página",
      error,
      { digest: "abc123" }
    );
  });

  it("muestra el código de seguimiento para correlacionar con el servidor", () => {
    renderConError("falló el render", "abc123");

    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("no rompe cuando el error no trae digest", () => {
    renderConError("falló el render");

    expect(mockLogClientError).toHaveBeenCalledWith(
      "Error al renderizar la página",
      expect.any(Error),
      { digest: undefined }
    );
    expect(screen.getByRole("heading", { name: /Algo salió mal/ })).toBeInTheDocument();
  });

  it("el botón Reintentar llama a reset de Next.js", async () => {
    const user = userEvent.setup();
    const { reset } = renderConError();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("siempre ofrece una salida: reintentar o volver al inicio", () => {
    renderConError();

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });
});
