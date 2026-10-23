import { enviarJson } from "@/lib/http";
import type { ProductoPayload } from "@/lib/productos-form";

export type ResultadoProducto =
  | { ok: true; idProducto: number | null; error: "" }
  | { ok: false; idProducto: null; error: string };

function resultado(ok: boolean, data: Record<string, unknown>, mensaje: string): ResultadoProducto {
  if (ok) {
    const id = Number(data.id_producto);
    return { ok: true, idProducto: Number.isFinite(id) && id > 0 ? id : null, error: "" };
  }
  return { ok: false, idProducto: null, error: String(data.error || mensaje) };
}

export async function crearProducto(payload: ProductoPayload): Promise<ResultadoProducto> {
  const { ok, data } = await enviarJson("/api/productos", payload);
  return resultado(ok, data, "No se pudo crear el producto");
}

export async function actualizarProducto(
  idProducto: number,
  payload: ProductoPayload
): Promise<ResultadoProducto> {
  const { ok, data } = await enviarJson(`/api/productos/${idProducto}`, payload, "PUT");
  return resultado(ok, data, "No se pudo actualizar el producto");
}
