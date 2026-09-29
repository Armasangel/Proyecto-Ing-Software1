import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("app/not-found.tsx (404)", () => {
  it("explica que la dirección no existe", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeInTheDocument();
    expect(screen.getByText(/no existe o cambió de lugar/)).toBeInTheDocument();
  });

  it("ofrece el acceso al login", () => {
    render(<NotFound />);

    // El 404 no ofrece "Reintentar": no hay request que reintentar.
    expect(screen.getByRole("link", { name: "Ir al login" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("no muestra un código de seguimiento porque no hubo error que rastrear", () => {
    render(<NotFound />);

    expect(screen.queryByText(/Código de seguimiento/)).not.toBeInTheDocument();
  });
});
