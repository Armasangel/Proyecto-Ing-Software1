import { etiquetaCliente, filtrarClientesPorTexto } from "@/lib/clientes-busqueda";

const clientes = [
  { nombre: "Carlos Ruiz", correo: "carlos@email.com" },
  { nombre: "Roberto Sin Correo", correo: null },
  { nombre: "Ana Gómez", correo: undefined },
];

describe("filtrarClientesPorTexto", () => {
  it("no se rompe cuando hay clientes sin correo (null o undefined)", () => {
    expect(() => filtrarClientesPorTexto(clientes, "car")).not.toThrow();
  });

  it("busca por nombre aunque el correo sea nulo", () => {
    expect(filtrarClientesPorTexto(clientes, "roberto").map((c) => c.nombre)).toEqual(["Roberto Sin Correo"]);
  });

  it("busca por correo sin distinguir mayúsculas", () => {
    expect(filtrarClientesPorTexto(clientes, "CARLOS@").map((c) => c.nombre)).toEqual(["Carlos Ruiz"]);
  });

  it("sin texto devuelve a todos", () => {
    expect(filtrarClientesPorTexto(clientes, "  ")).toHaveLength(3);
  });

  it("no confunde 'null' con un correo: buscar 'null' no trae a quien no tiene correo", () => {
    expect(filtrarClientesPorTexto(clientes, "null")).toHaveLength(0);
  });
});

describe("etiquetaCliente", () => {
  it("muestra nombre y correo", () => {
    expect(etiquetaCliente(clientes[0])).toBe("Carlos Ruiz (carlos@email.com)");
  });

  it("sin correo muestra solo el nombre, nunca (null)", () => {
    expect(etiquetaCliente(clientes[1])).toBe("Roberto Sin Correo");
    expect(etiquetaCliente(clientes[2])).toBe("Ana Gómez");
  });
});
