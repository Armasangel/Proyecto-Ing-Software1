import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarcaAutocompletar } from "@/components/inventario-catalogo/MarcaAutocompletar";

const marcas = [
  { id_marca: 1, nombre_marca: "Alfa", usos: 0 },
  ...Array.from({ length: 6 }, (_, i) => ({ id_marca: i + 2, nombre_marca: `Marca ${i + 2}`, usos: 10 - i })),
  { id_marca: 8, nombre_marca: "Café Especial", usos: 0 },
];

function Editor({ inicial = "", onCambio = jest.fn(), filtro = false }: { inicial?: string; onCambio?: (id: string) => void; filtro?: boolean }) {
  const [value, setValue] = useState(inicial);
  return <>
    <MarcaAutocompletar marcas={marcas} value={value} opcional={filtro} textoSinSeleccion="Todas las marcas"
      onChange={(id) => { setValue(id); onCambio(id); }} />
    <button type="button">Fuera</button>
  </>;
}

describe("MarcaAutocompletar", () => {
  it("shows exactly the five most used brands, sorted by product count", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("combobox", { name: "Marca" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Marca 2", "Marca 3", "Marca 4", "Marca 5", "Marca 6"]);
    expect(screen.getByText("Más usadas · escribe para ver más")).toBeInTheDocument();
  });

  it("searches all brands, including less used ones, ignoring case and accents", async () => {
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor onCambio={onCambio} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    expect(screen.queryByRole("option", { name: "Café Especial" })).not.toBeInTheDocument();
    await user.type(input, "CAFE");
    await user.click(screen.getByRole("option", { name: "Café Especial" }));
    expect(input).toHaveValue("Café Especial");
    expect(onCambio).toHaveBeenLastCalledWith("8");
  });

  it("uses alphabetical order for ties and includes brands with no products", async () => {
    const user = userEvent.setup();
    render(<MarcaAutocompletar marcas={[
      { id_marca: 3, nombre_marca: "Zeta", usos: 0 },
      { id_marca: 2, nombre_marca: "Beta", usos: 0 },
      { id_marca: 1, nombre_marca: "Alfa", usos: 0 },
    ]} value="" onChange={jest.fn()} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Alfa", "Beta", "Zeta"]);
  });

  it("keeps the current selection even when it is outside the five suggestions or a search is abandoned", async () => {
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor inicial="8" onCambio={onCambio} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Café Especial");
    await user.click(input);
    await user.type(input, "sin resultados");
    expect(screen.getByText("Sin resultados. Puedes crear una marca.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fuera" }));
    expect(input).toHaveValue("Café Especial");
    expect(onCambio).not.toHaveBeenCalled();
  });

  it("refreshes the ranking when counts change and displays externally created selections", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(<MarcaAutocompletar marcas={marcas} value="" onChange={onChange} />);
    rerender(<MarcaAutocompletar marcas={[...marcas, { id_marca: 9, nombre_marca: "Nueva", usos: 100 }]} value="9" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toHaveValue("Nueva");
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Nueva");
  });

  it("can clear the brand filter back to all brands", async () => {
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor inicial="2" filtro onCambio={onCambio} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("button", { name: "Dejar Marca todas las marcas" }));
    expect(onCambio).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Todas las marcas");
  });
});
