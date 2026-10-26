import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriaAutocompletar } from "@/components/inventario-catalogo/CategoriaAutocompletar";

const categorias = Array.from({ length: 12 }, (_, i) => ({ id_categoria: i + 1, nombre_categoria: i === 11 ? "Lácteos especiales" : `Categoría ${i + 1}` }));

function Editor({ opcional = false, inicial = "", onCambio = jest.fn() }: { opcional?: boolean; inicial?: string; onCambio?: (id: string) => void }) {
  const [value, setValue] = useState(inicial);
  return <>
    <CategoriaAutocompletar categorias={categorias} value={value} ariaLabel="Categoría" opcional={opcional}
      onChange={(id) => { setValue(id); onCambio(id); }} />
    <button type="button">Fuera del campo</button>
  </>;
}

describe("CategoriaAutocompletar", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows five distinct random categories and searches beyond the sample without case or accent restrictions", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor onCambio={onCambio} />);
    const input = screen.getByRole("combobox", { name: "Categoría" });
    await user.click(input);
    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(new Set(screen.getAllByRole("option").map((o) => o.textContent)).size).toBe(5);
    expect(screen.queryByRole("option", { name: "Lácteos especiales" })).not.toBeInTheDocument();
    await user.type(input, "LACTEOS");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: "Lácteos especiales" }));
    expect(input).toHaveValue("Lácteos especiales");
    expect(onCambio).toHaveBeenLastCalledWith("12");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("draws a new sample on reopening and limits typed matches to eight", async () => {
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<Editor />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    const primera = screen.getAllByRole("option").map((o) => o.textContent);
    await user.keyboard("{Escape}");
    random.mockReturnValue(0.999);
    await user.click(input);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).not.toEqual(primera);
    await user.type(input, "categoría");
    expect(screen.getAllByRole("option")).toHaveLength(8);
  });

  it("offers Sin categoría only for optional fields and clears the selection", async () => {
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor opcional inicial="2" onCambio={onCambio} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Categoría 2");
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Dejar Categoría sin categoría" }));
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Sin categoría");
    expect(onCambio).toHaveBeenLastCalledWith("");
  });

  it("preserves the selected ID when a search has no match and focus moves away", async () => {
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor inicial="2" onCambio={onCambio} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    expect(screen.queryByRole("button", { name: /sin categoría/i })).not.toBeInTheDocument();
    await user.type(input, "sin coincidencias");
    expect(screen.getByText("Sin resultados. Puedes crear una categoría.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fuera del campo" }));
    expect(input).toHaveValue("Categoría 2");
    expect(onCambio).not.toHaveBeenCalled();
  });

  it("supports keyboard selection and initially supplied IDs", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const onCambio = jest.fn();
    const user = userEvent.setup();
    render(<Editor inicial="8" onCambio={onCambio} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Categoría 8");
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onCambio).toHaveBeenLastCalledWith("2");
    expect(input).toHaveValue("Categoría 2");
  });

  it("updates the displayed name after an external creation or asynchronous catalog load", () => {
    const onChange = jest.fn();
    const { rerender } = render(<CategoriaAutocompletar categorias={[]} value="2" onChange={onChange} ariaLabel="Categoría" />);
    rerender(<CategoriaAutocompletar categorias={categorias} value="2" onChange={onChange} ariaLabel="Categoría" />);
    expect(screen.getByRole("combobox")).toHaveValue("Categoría 2");
    rerender(<CategoriaAutocompletar categorias={categorias} value="12" onChange={onChange} ariaLabel="Categoría" />);
    expect(screen.getByRole("combobox")).toHaveValue("Lácteos especiales");
    expect(onChange).not.toHaveBeenCalled();
  });
});
