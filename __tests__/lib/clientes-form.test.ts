import { CLIENTE_FORM_VACIO, validarClienteForm } from "@/lib/clientes-form";

function formulario(overrides: Partial<typeof CLIENTE_FORM_VACIO> = {}) {
  return { ...CLIENTE_FORM_VACIO, ...overrides };
}

describe("validarClienteForm", () => {
  it("normaliza el nombre, el correo y el código del cliente", () => {
    const resultado = validarClienteForm(
      formulario({
        nombre: "  Ana López  ",
        correo: " ana@cliente.com ",
        telefono: " 5555-5555 ",
        codigo_cliente: " cli-0001 ",
        limite_deuda: "150.50",
      })
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.payload).toMatchObject({
      nombre: "Ana López",
      correo: "ana@cliente.com",
      telefono: "5555-5555",
      codigo_cliente: "CLI-0001",
      limite_deuda: 150.5,
    });
    expect(resultado.deudaInicial).toBeNull();
  });

  it("exige el nombre", () => {
    expect(validarClienteForm(formulario({ nombre: "   " }))).toEqual({
      ok: false,
      error: "El nombre del cliente es obligatorio",
    });
  });

  it("exige y valida el correo cuando la variante lo requiere", () => {
    expect(
      validarClienteForm(formulario({ nombre: "Ana", correo: "" }), {
        correoObligatorio: true,
      })
    ).toEqual({
      ok: false,
      error: "El correo es obligatorio para crear un cliente desde Ventas",
    });

    expect(
      validarClienteForm(formulario({ nombre: "Ana", correo: "no-es-correo" }), {
        correoObligatorio: true,
        validarFormatoCorreo: true,
      })
    ).toEqual({
      ok: false,
      error: "Escribe un correo válido (ej. nombre@correo.com)",
    });
  });

  it("permite correo vacío o sin formato cuando no es obligatorio", () => {
    const resultado = validarClienteForm(
      formulario({ nombre: "Ana", correo: "sin-formato" }),
      { correoObligatorio: false, validarFormatoCorreo: false }
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.payload.correo).toBe("sin-formato");
  });

  it("valida el saldo anterior solo cuando la variante lo incluye", () => {
    expect(
      validarClienteForm(formulario({ nombre: "Ana", deuda_inicial: "0" }), {
        incluirSaldoAnterior: true,
      })
    ).toEqual({
      ok: false,
      error: "El saldo inicial debe ser un número mayor a 0",
    });

    const resultado = validarClienteForm(
      formulario({ nombre: "Ana", deuda_inicial: "350.50" }),
      { incluirSaldoAnterior: true }
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.deudaInicial).toBe(350.5);
    expect(resultado.payload).not.toHaveProperty("deuda_inicial");
  });

  it("valida el límite y el formato del código de cliente", () => {
    expect(
      validarClienteForm(formulario({ nombre: "Ana", limite_deuda: "-1" }))
    ).toEqual({
      ok: false,
      error: "El límite de crédito debe ser un número mayor o igual a 0",
    });

    expect(
      validarClienteForm(formulario({ nombre: "Ana", codigo_cliente: "CLI 001" }))
    ).toEqual({
      ok: false,
      error:
        "El código del cliente solo puede tener letras, números, guiones, puntos o guiones bajos",
    });
  });
});
