import { matchesQuery } from "@/lib/ui-table";

/**
 * En la base de datos `cliente.correo` y `cliente.telefono` pueden ser NULL
 * (por ejemplo, un cliente creado desde Deudas solo con su nombre). Por eso
 * estos helpers aceptan correo vacío y nunca deben llamar métodos de string
 * directamente sobre él.
 */
export type ClienteBuscable = {
  nombre: string;
  correo?: string | null;
  codigo_cliente?: string | null;
  nit_cliente?: string | null;
  telefono?: string | null;
};

/**
 * Filtra clientes por texto. Sin texto devuelve todos. Se busca por nombre,
 * correo, código, NIT o teléfono. No se rompe con correo nulo.
 */
export function filtrarClientesPorTexto<T extends ClienteBuscable>(clientes: T[], texto: string): T[] {
  return clientes.filter((c) =>
    matchesQuery(texto, c.nombre, c.correo, c.codigo_cliente, c.nit_cliente, c.telefono)
  );
}

/** "Pedro Díaz (pedro@mail.com)" o solo "Pedro Díaz" si no tiene correo (nunca "(null)"). */
export function etiquetaCliente(c: ClienteBuscable): string {
  return c.correo ? `${c.nombre} (${c.correo})` : c.nombre;
}
