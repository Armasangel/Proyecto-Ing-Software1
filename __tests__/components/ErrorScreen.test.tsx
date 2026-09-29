import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorScreen } from "@/components/ErrorScreen";

describe("ErrorScreen", () => {
  it("muestra el título y la descripción", () => {
    render(<ErrorScreen titulo="Algo salió mal" descripcion="Reintentá en un momento." />);

    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toBeInTheDocument();
    expect(screen.getByText("Reintentá en un momento.")).toBeInTheDocument();
  });

  it("muestra el código de seguimiento cuando hay digest", () => {
    render(<ErrorScreen titulo="Error" descripcion="..." digest="abc123" />);

    // Es el vínculo con el log del servidor: sin esto el error de cliente es
    // un código que nadie puede buscar.
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("omite el código de seguimiento cuando no hay digest", () => {
    render(<ErrorScreen titulo="Error" descripcion="..." />);

    expect(screen.queryByText(/Código de seguimiento/)).not.toBeInTheDocument();
  });

  it("no muestra el botón de reintento si no se pasa onRetry", () => {
    render(<ErrorScreen titulo="Página no encontrada" descripcion="..." />);

    expect(screen.queryByRole("button", { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  it("ejecuta onRetry al presionar el botón", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<ErrorScreen titulo="Error" descripcion="..." onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("permite personalizar el texto del botón de reintento", () => {
    render(<ErrorScreen titulo="Error" descripcion="..." onRetry={jest.fn()} retryLabel="Cargar de nuevo" />);

    expect(screen.getByRole("button", { name: "Cargar de nuevo" })).toBeInTheDocument();
  });

  it("enlaza al inicio por defecto y con destino personalizable", () => {
    const { rerender } = render(<ErrorScreen titulo="Error" descripcion="..." />);
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");

    rerender(<ErrorScreen titulo="Error" descripcion="..." inicioHref="/login" inicioLabel="Ir al login" />);
    expect(screen.getByRole("link", { name: "Ir al login" })).toHaveAttribute("href", "/login");
  });
});
