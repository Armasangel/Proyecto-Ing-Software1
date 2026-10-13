import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductoAutocompletar, muestraAleatoria, normalizarTexto } from "@/components/ProductoAutocompletar";

const catalogo = Array.from({ length: 12 }, (_, i) => ({
  id_producto: i + 1,
  codigo_producto: `P-${String(i + 1).padStart(3, "0")}`,
  nombre_producto: i === 0 ? "Café molido" : `Producto ${i + 1}`,
}));

function Wrapper({ onCambio }: { onCambio?: (id: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <>
      <ProductoAutocompletar
        productos={catalogo}
        value={valor}
        onChange={(id) => {
          setValor(id);
          onCambio?.(id);
        }}
      />
      <button type="button" onClick={() => setValor("")}>
        limpiar
      </button>
      <button type="button" onClick={() => setValor("3")}>
        precargar
      </button>
      <output data-testid="valor">{valor}</output>
    </>
  );
}

describe("helpers", () => {
  it("normalizarTexto ignores case and accents", () => {
    expect(normalizarTexto("CAFÉ")).toBe("cafe");
  });

  it("muestraAleatoria returns n distinct items from the list", () => {
    const m = muestraAleatoria(catalogo, 5);
    expect(m).toHaveLength(5);
    expect(new Set(m.map((p) => p.id_producto)).size).toBe(5);
    expect(muestraAleatoria(catalogo.slice(0, 2), 5)).toHaveLength(2);
  });
});

describe("ProductoAutocompletar", () => {
  it("shows only 5 random products when focused without typing", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("textbox", { name: "Producto" }));
    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(screen.getByText(/Sugeridos/)).toBeInTheDocument();
  });

  it("searches the whole catalog by name or code while typing", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Producto" });
    await user.click(campo);
    await user.type(campo, "cafe"); // sin acento ni mayúscula
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Café molido")).toBeInTheDocument();

    await user.clear(campo);
    await user.type(campo, "P-01"); // por código: P-010, P-011, P-012
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("limits typed results to 8 and says when there are none", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Producto" });
    await user.click(campo);
    await user.type(campo, "Producto");
    expect(screen.getAllByRole("option")).toHaveLength(8);
    await user.clear(campo);
    await user.type(campo, "zzz");
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("emits the id when an option is picked, and clears it when the user edits the text", async () => {
    const user = userEvent.setup();
    const onCambio = jest.fn();
    render(<Wrapper onCambio={onCambio} />);
    const campo = screen.getByRole("textbox", { name: "Producto" });
    await user.click(campo);
    await user.type(campo, "cafe");
    await user.click(screen.getByText("Café molido"));
    expect(onCambio).toHaveBeenLastCalledWith("1");
    expect(campo).toHaveValue("Café molido (P-001)");

    await user.type(campo, "x");
    expect(onCambio).toHaveBeenLastCalledWith("");
    expect(screen.getByTestId("valor")).toHaveTextContent("");
  });

  it("auto-selects on blur when the typed text matches exactly one product", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Producto" });
    await user.click(campo);
    await user.type(campo, "cafe");
    await user.tab();
    expect(screen.getByTestId("valor")).toHaveTextContent("1");
    expect(campo).toHaveValue("Café molido (P-001)");
  });

  it("follows external changes of value (reset and preload)", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Producto" });
    await user.click(screen.getByRole("button", { name: "precargar" }));
    expect(campo).toHaveValue("Producto 3 (P-003)");
    await user.click(screen.getByRole("button", { name: "limpiar" }));
    expect(campo).toHaveValue("");
  });
});
