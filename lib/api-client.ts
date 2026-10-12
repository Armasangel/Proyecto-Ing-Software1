/**
 * Cliente HTTP centralizado para llamar a `/api/*` desde el navegador.
 *
 * Reemplaza el patrón repetido en cada pantalla:
 *
 *   const res = await fetch(url, { method, headers: {...}, body: JSON.stringify(x) });
 *   const data = await res.json();          // revienta si el cuerpo no es JSON
 *   if (!res.ok) setError(data.error || "…");
 *
 * por una sola llamada tipada que lanza `ApiError` cuando algo sale mal:
 *
 *   const { deudas } = await api.get<DeudasListResponse>("/api/deudas");
 *   await api.post<RegistrarPagoResponse>(`/api/deudas/${id}/pagos`, body);
 *
 * Los tipos de petición/respuesta viven en `lib/api-types.ts` y los comparten
 * el frontend y las rutas del backend.
 *
 * No depende de React; los hooks (`useQuery`, `useMutation`) están en
 * `hooks/useApi.ts`.
 */

import type { ApiErrorBody } from "@/lib/api-types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const MENSAJE_SIN_CONEXION = "No se pudo conectar con el servidor.";
export const MENSAJE_RESPUESTA_INVALIDA = "El servidor devolvió una respuesta inesperada.";

/**
 * Error de una llamada a la API.
 *  - `status` > 0: el servidor respondió con un código de error HTTP.
 *  - `status` === 0: no hubo respuesta (sin red, servidor caído, CORS…).
 *
 * `message` ya viene listo para mostrarse al usuario: es el `error` que envía
 * la API (ver `lib/api-error.ts`) o un texto genérico en español.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Cuerpo JSON de la respuesta de error, si lo había. */
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export type FetchJsonOptions = {
  method?: HttpMethod;
  /** Se serializa a JSON automáticamente (y se agrega `Content-Type`). */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Mensaje si el servidor falla sin enviar un `error` legible. */
  fallbackError?: string;
};

function mensajePorStatus(status: number): string {
  if (status === 401) return "Tu sesión expiró. Inicia sesión de nuevo.";
  if (status === 403) return "No tienes permiso para realizar esta acción.";
  if (status === 404) return "No se encontró el recurso solicitado.";
  if (status === 429) return "Demasiadas solicitudes, intenta de nuevo en un momento.";
  if (status >= 500) return "Error interno del servidor.";
  return `No se pudo completar la solicitud (HTTP ${status}).`;
}

function extraerMensaje(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const msg = (body as Partial<ApiErrorBody>).error;
    if (typeof msg === "string" && msg.trim() !== "") return msg;
  }
  return null;
}

/** Lee el cuerpo como JSON sin reventar si está vacío o no es JSON. */
async function leerJson(res: Response): Promise<{ ok: true; data: unknown } | { ok: false }> {
  let texto: string;
  try {
    texto = await res.text();
  } catch {
    return { ok: false };
  }
  if (texto.trim() === "") return { ok: true, data: null };
  try {
    return { ok: true, data: JSON.parse(texto) };
  } catch {
    return { ok: false };
  }
}

/**
 * Hace una petición JSON y devuelve el cuerpo ya tipado como `T`.
 * Lanza `ApiError` si no hay red, si el servidor responde con error o si la
 * respuesta exitosa no es JSON válido.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { method = "GET", body, headers, signal, fallbackError } = options;

  const init: RequestInit = { method, signal, headers: { ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json", ...headers };
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // Un abort lo provoca el propio código (p. ej. al desmontar): no es un
    // fallo de red, se deja pasar tal cual.
    if ((err as { name?: string } | null)?.name === "AbortError") throw err;
    throw new ApiError(MENSAJE_SIN_CONEXION, 0);
  }

  const parsed = await leerJson(res);

  if (!res.ok) {
    const cuerpo = parsed.ok ? parsed.data : undefined;
    throw new ApiError(
      extraerMensaje(cuerpo) ?? fallbackError ?? mensajePorStatus(res.status),
      res.status,
      cuerpo
    );
  }

  if (!parsed.ok) throw new ApiError(MENSAJE_RESPUESTA_INVALIDA, res.status);
  return parsed.data as T;
}

/** Atajos por método HTTP: `api.get<T>(url)`, `api.post<T>(url, body)`… */
export const api = {
  get: <T>(url: string, options?: Omit<FetchJsonOptions, "method" | "body">) =>
    fetchJson<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, body?: unknown, options?: Omit<FetchJsonOptions, "method" | "body">) =>
    fetchJson<T>(url, { ...options, method: "POST", body }),
  put: <T>(url: string, body?: unknown, options?: Omit<FetchJsonOptions, "method" | "body">) =>
    fetchJson<T>(url, { ...options, method: "PUT", body }),
  patch: <T>(url: string, body?: unknown, options?: Omit<FetchJsonOptions, "method" | "body">) =>
    fetchJson<T>(url, { ...options, method: "PATCH", body }),
  delete: <T>(url: string, options?: Omit<FetchJsonOptions, "method" | "body">) =>
    fetchJson<T>(url, { ...options, method: "DELETE" }),
};

/**
 * Texto para mostrarle al usuario a partir de cualquier error capturado.
 * Si es un `ApiError` usa su mensaje; con cualquier otra cosa devuelve
 * `fallback`, para no filtrar mensajes internos (`TypeError: …`) a la UI.
 */
export function getErrorMessage(err: unknown, fallback = "Ocurrió un error inesperado."): string {
  return err instanceof ApiError ? err.message : fallback;
}
