import { enviarJson } from "@/lib/http";
import type { ClienteCreado, ClientePayload } from "@/lib/clientes-form";

export type CrearClienteResultado =
  | { ok: true; cliente: ClienteCreado }
  | { ok: false; error: string };

export async function crearCliente(payload: ClientePayload): Promise<CrearClienteResultado> {
  try {
    const { ok, data } = await enviarJson("/api/clientes", payload);
    if (!ok) {
      return {
        ok: false,
        error: String(data.error || "No se pudo crear el cliente"),
      };
    }
    return {
      ok: true,
      cliente: (data.cliente ?? data) as ClienteCreado,
    };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}
