import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ClienteAutocompletar,
  clienteCoincide,
  etiquetaClienteConCodigo,
  type ClienteOpcion,
} from "@/components/ClienteAutocompletar";

const clientes: ClienteOpcion[] = [
  {
    id_cliente: 1,
    nombre: "Carlos Ruiz",
    codigo_cliente: "CLI-00001",
    nit_cliente: "1234567-8",
    telefono: "55551234",
    correo: "carlos@email.com",
    direccion: "1a. calle 10-20",
  },
  {
    id_cliente: 2,
    nombre: "Ana García",
    codigo_cliente: "CLI-00002",
    nit_cliente: "8765432-1",
    telefono: "55559999",
    correo: "ana@email.com",
    direccion: "5a. avenida 3-45",
  },
  {
    id_cliente: 3,
    nombre: "Consumidor Final",
    codigo_cliente: "CLI-00003",
    nit_cliente: "CF",
    telefono: null,
    correo: null,
    direccion: null,
    es_consumidor_final: true,
  },
];

function Wrapper({
  onSeleccion,
  sugeridos,
}: {
  onSeleccion?: (c: ClienteOpcion) => void;
  sugeridos?: ClienteOpcion[];
}) {
  const [valor, setValor] = useState("");
  return (
    <>
      <ClienteAutocompletar
        clientes={clientes}
        sugeridos={sugeridos}
        value={valor}
        onChange={setValor}
        onSelect={onSeleccion}
      />
      <button type="button" onClick={() => setValor("2")}>
        precargar
      </button>
      <output data-testid="valor">{valor}</output>
    </>
  );
}

describe("helpers", () => {
  it("etiquetaClienteConCodigo muestra nombre y código", () => {
    expect(etiquetaClienteConCodigo(clientes[0])).toBe("Carlos Ruiz (CLI-00001)");
  });

  it("etiquetaClienteConCodigo omite el código si el cliente no tiene", () => {
    expect(etiquetaClienteConCodigo({ id_cliente: 9, nombre: "Sin código" })).toBe("Sin código");
  });

  it("clienteCoincide busca por código, nombre, NIT, teléfono y correo", () => {
    expect(clienteCoincide(clientes[0], "cli-00001")).toBe(true);
    expect(clienteCoincide(clientes[0], "carlos")).toBe(true);
    expect(clienteCoincide(clientes[0], "1234567")).toBe(true);
    expect(clienteCoincide(clientes[0], "55551234")).toBe(true);
    expect(clienteCoincide(clientes[0], "CARLOS@")).toBe(true);
  });

  it("clienteCoincide ignora mayúsculas y acentos", () => {
    expect(clienteCoincide(clientes[1], "ANA GARCÍA")).toBe(true);
    expect(clienteCoincide(clientes[1], "ana garcia")).toBe(true);
  });

  it("clienteCoincide no revienta con campos nulos", () => {
    expect(clienteCoincide(clientes[2], "final")).toBe(true);
    expect(clienteCoincide(clientes[2], "nada de esto")).toBe(false);
  });
});

/** Reproduce "crear cliente y seleccionarlo": llega el cliente al catálogo y a
 * la vez la pantalla lo deja elegido. */
function WrapperNuevoCliente() {
  const [valor, setValor] = useState("");
  const [catalogo, setCatalogo] = useState<ClienteOpcion[]>(clientes);
  const nuevo: ClienteOpcion = {
    id_cliente: 9,
    nombre: "Pedro Nuevo",
    codigo_cliente: "CLI-00009",
    correo: "pedro@correo.com",
  };
  return (
    <>
      <ClienteAutocompletar clientes={catalogo} value={valor} onChange={setValor} />
      <button
        type="button"
        onClick={() => {
          setCatalogo((c) => [...c, nuevo]);
          setValor("9");
        }}
      >
        crear y elegir
      </button>
    </>
  );
}

describe("ClienteAutocompletar", () => {  it("muestra el código junto al nombre en las sugerencias", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("textbox", { name: "Cliente" }));
    await user.type(screen.getByRole("textbox", { name: "Cliente" }), "carlos");
    expect(screen.getByText("Carlos Ruiz")).toBeInTheDocument();
    expect(screen.getByText("CLI-00001")).toBeInTheDocument();
  });

  it("busca por código", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(campo);
    await user.type(campo, "cli-00002");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("busca por NIT sin importar los guiones", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(campo);
    await user.type(campo, "8765432");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("avisa cuando no hay coincidencias", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(campo);
    await user.type(campo, "zzzzz");
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("entrega el cliente completo al elegirlo", async () => {
    const user = userEvent.setup();
    const onSeleccion = jest.fn();
    render(<Wrapper onSeleccion={onSeleccion} />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(campo);
    await user.type(campo, "carlos");
    await user.click(screen.getByText("Carlos Ruiz"));

    expect(onSeleccion).toHaveBeenCalledTimes(1);
    expect(onSeleccion.mock.calls[0][0]).toMatchObject({
      id_cliente: 1,
      codigo_cliente: "CLI-00001",
      nit_cliente: "1234567-8",
      direccion: "1a. calle 10-20",
    });
    expect(screen.getByTestId("valor")).toHaveTextContent("1");
    expect(campo).toHaveValue("Carlos Ruiz (CLI-00001)");
  });

  it("usa los sugeridos que le pasan, si los hay", async () => {
    const user = userEvent.setup();
    render(<Wrapper sugeridos={[clientes[1]]} />);
    await user.click(screen.getByRole("textbox", { name: "Cliente" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("sigue los cambios externos de value", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(screen.getByRole("button", { name: "precargar" }));
    expect(campo).toHaveValue("Ana García (CLI-00002)");
  });

  it("limpia el cliente elegido cuando el usuario edita el texto", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(campo);
    await user.type(campo, "carlos");
    await user.click(screen.getByText("Carlos Ruiz"));
    expect(screen.getByTestId("valor")).toHaveTextContent("1");

    await user.type(campo, "x");
    expect(screen.getByTestId("valor")).toHaveTextContent("");
  });

  it("muestra el cliente recién creado y seleccionado desde afuera", async () => {
    const user = userEvent.setup();
    render(<WrapperNuevoCliente />);
    const campo = screen.getByRole("textbox", { name: "Cliente" });
    await user.click(screen.getByRole("button", { name: "crear y elegir" }));
    expect(campo).toHaveValue("Pedro Nuevo (CLI-00009)");
  });
});
