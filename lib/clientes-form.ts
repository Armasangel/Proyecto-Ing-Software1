import { TIPOS_CLIENTE, type TipoCliente } from "@/lib/tipos-cliente";

export const NIT_MAX = 20;
export const CODIGO_POSTAL_MAX = 10;
export const DIRECCION_MAX = 255;
export const CODIGO_CLIENTE_MAX = 20;

export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODIGO_CLIENTE_VALIDO = /^[A-Z0-9][A-Z0-9._-]*$/;

export type ClienteFormValues = {
  nombre: string;
  telefono: string;
  correo: string;
  tipo_cliente: string;
  limite_deuda: string;
  deuda_inicial: string;
  nit_cliente: string;
  codigo_postal: string;
  direccion: string;
  codigo_cliente: string;
};

export const CLIENTE_FORM_VACIO: ClienteFormValues = {
  nombre: "",
  telefono: "",
  correo: "",
  tipo_cliente: "MINORISTA",
  limite_deuda: "",
  deuda_inicial: "",
  nit_cliente: "",
  codigo_postal: "",
  direccion: "",
  codigo_cliente: "",
};

export type ClientePayload = {
  nombre: string;
  telefono: string;
  correo: string;
  tipo_cliente: TipoCliente;
  limite_deuda: number | null;
  nit_cliente: string;
  codigo_postal: string;
  direccion: string;
  codigo_cliente: string;
};

export type ClienteCreado = {
  id_cliente: number;
  nombre: string;
  correo: string | null;
  tipo_cliente: string;
  telefono?: string | null;
  estado_cliente?: boolean;
  limite_deuda?: string | null;
  total_ventas?: number;
  es_consumidor_final?: boolean;
  nit_cliente?: string | null;
  codigo_postal?: string | null;
  direccion?: string | null;
  codigo_cliente?: string | null;
};

export type ClienteFormOpciones = {
  correoObligatorio?: boolean;
  validarFormatoCorreo?: boolean;
  incluirSaldoAnterior?: boolean;
  mensajeNombre?: string;
};

export type ClienteFormValidado =
  | { ok: true; payload: ClientePayload; deudaInicial: number | null }
  | { ok: false; error: string };

function numeroOpcional(valor: string): number | null {
  return valor.trim() === "" ? null : Number(valor);
}

function tipoClienteValido(valor: string): TipoCliente {
  return (TIPOS_CLIENTE as readonly string[]).includes(valor)
    ? (valor as TipoCliente)
    : "MINORISTA";
}

export function validarClienteForm(
  values: ClienteFormValues,
  opciones: ClienteFormOpciones = {}
): ClienteFormValidado {
  const nombre = values.nombre.trim();
  if (!nombre) {
    return {
      ok: false,
      error: opciones.mensajeNombre ?? "El nombre del cliente es obligatorio",
    };
  }

  const correo = values.correo.trim();
  if (opciones.correoObligatorio && !correo) {
    return {
      ok: false,
      error: "El correo es obligatorio para crear un cliente desde Ventas",
    };
  }
  if (opciones.validarFormatoCorreo && correo && !CORREO_VALIDO.test(correo)) {
    return {
      ok: false,
      error: "Escribe un correo válido (ej. nombre@correo.com)",
    };
  }

  const limite = numeroOpcional(values.limite_deuda);
  if (limite !== null && (!Number.isFinite(limite) || limite < 0)) {
    return {
      ok: false,
      error: "El límite de crédito debe ser un número mayor o igual a 0",
    };
  }

  const deudaInicial = numeroOpcional(values.deuda_inicial);
  if (
    opciones.incluirSaldoAnterior &&
    deudaInicial !== null &&
    (!Number.isFinite(deudaInicial) || deudaInicial <= 0)
  ) {
    return {
      ok: false,
      error: "El saldo inicial debe ser un número mayor a 0",
    };
  }

  const nit = values.nit_cliente.trim();
  if (nit.length > NIT_MAX) {
    return { ok: false, error: `El NIT no puede superar los ${NIT_MAX} caracteres` };
  }

  const codigoPostal = values.codigo_postal.trim();
  if (codigoPostal.length > CODIGO_POSTAL_MAX) {
    return {
      ok: false,
      error: `El código postal no puede superar los ${CODIGO_POSTAL_MAX} caracteres`,
    };
  }

  const direccion = values.direccion.trim();
  if (direccion.length > DIRECCION_MAX) {
    return {
      ok: false,
      error: `La dirección no puede superar los ${DIRECCION_MAX} caracteres`,
    };
  }

  const codigoCliente = values.codigo_cliente.trim().toUpperCase();
  if (codigoCliente.length > CODIGO_CLIENTE_MAX) {
    return {
      ok: false,
      error: `El código del cliente no puede superar los ${CODIGO_CLIENTE_MAX} caracteres`,
    };
  }
  if (codigoCliente && !CODIGO_CLIENTE_VALIDO.test(codigoCliente)) {
    return {
      ok: false,
      error:
        "El código del cliente solo puede tener letras, números, guiones, puntos o guiones bajos",
    };
  }

  return {
    ok: true,
    payload: {
      nombre,
      telefono: values.telefono.trim(),
      correo,
      tipo_cliente: tipoClienteValido(values.tipo_cliente),
      limite_deuda: limite,
      nit_cliente: nit,
      codigo_postal: codigoPostal,
      direccion,
      codigo_cliente: codigoCliente,
    },
    deudaInicial: opciones.incluirSaldoAnterior ? deudaInicial : null,
  };
}
