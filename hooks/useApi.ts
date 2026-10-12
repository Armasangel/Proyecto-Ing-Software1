"use client";

/**
 * Hooks de React sobre `lib/api-client.ts` que concentran el estado de
 * `data / loading / error` que antes se repetía con `useState` en cada pantalla.
 *
 *  - `useQuery`    → lecturas (GET) que se cargan al montar y se pueden refrescar.
 *  - `useMutation` → escrituras (POST/PATCH/…) disparadas por el usuario.
 *
 * Ambos devuelven `error` como texto listo para mostrar (`""` si no hay error).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, getErrorMessage } from "@/lib/api-client";

// ─── useQuery ────────────────────────────────────────────────────────────────

type QueryState<T> = { data: T | null; loading: boolean; error: string; forUrl: string | null };

export type UseQueryOptions<T> = {
  /** Valor mientras llega la respuesta; con él, `data` nunca es `null`. */
  initialData?: T;
  /** Mensaje si falla y el servidor no envía uno propio. */
  errorMessage?: string;
};

export type UseQueryResult<T, TData = T | null> = {
  data: TData;
  loading: boolean;
  error: string;
  /** Vuelve a pedir los datos (devuelve cuando termina). */
  refetch: () => Promise<void>;
  /** Actualiza `data` localmente sin ir al servidor (cambios optimistas). */
  setData: (updater: TData | ((prev: TData) => TData)) => void;
};

/**
 * GET automático al montar. Pasar `url = null` desactiva la consulta.
 * Ignora las respuestas que llegan después de desmontar o de cambiar la URL.
 */
export function useQuery<T>(
  url: string | null,
  options: UseQueryOptions<T> & { initialData: T }
): UseQueryResult<T, T>;
export function useQuery<T>(url: string | null, options?: UseQueryOptions<T>): UseQueryResult<T>;
export function useQuery<T>(url: string | null, options: UseQueryOptions<T> = {}): UseQueryResult<T> {
  const { initialData, errorMessage = "No se pudieron cargar los datos." } = options;
  const [state, setState] = useState<QueryState<T>>({
    data: initialData ?? null,
    loading: url !== null,
    error: "",
    forUrl: url,
  });
  const requestId = useRef(0);

  // Hace la petición y guarda el resultado, salvo que ya haya otra más reciente.
  const run = useCallback(
    async (id: number) => {
      if (url === null) return;
      try {
        const data = await api.get<T>(url, { fallbackError: errorMessage });
        if (id === requestId.current) setState({ data, loading: false, error: "", forUrl: url });
      } catch (err) {
        if (id === requestId.current) {
          setState((s) => ({ ...s, loading: false, error: getErrorMessage(err, errorMessage), forUrl: url }));
        }
      }
    },
    [url, errorMessage]
  );

  useEffect(() => {
    const id = ++requestId.current;
    void run(id);
    return () => {
      // Intencional: se quiere el valor *actual* del contador (no una copia) para
      // invalidar la petición en vuelo; no es una referencia a un nodo del DOM.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++;
    };
  }, [run]);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    await run(id);
  }, [run]);

  const setData = useCallback((updater: T | null | ((prev: T | null) => T | null)) => {
    setState((s) => ({
      ...s,
      data: typeof updater === "function" ? (updater as (prev: T | null) => T | null)(s.data) : updater,
    }));
  }, []);

  return {
    data: state.data,
    // Si la URL cambió y aún no llega la nueva respuesta, también está cargando.
    loading: url !== null && (state.loading || state.forUrl !== url),
    error: state.error,
    refetch,
    setData,
  };
}

// ─── useMutation ─────────────────────────────────────────────────────────────

type MutationState<TVars, TRes> = {
  loading: boolean;
  error: string;
  data: TRes | null;
  variables: TVars | undefined;
};

export type UseMutationOptions = {
  /** Mensaje si falla por algo que no es un `ApiError`. */
  errorMessage?: string;
};

export type UseMutationResult<TVars, TRes> = {
  /**
   * Ejecuta la mutación. Devuelve la respuesta, o `undefined` si falló (el
   * mensaje queda en `error`). Nunca lanza.
   */
  run: (vars: TVars) => Promise<TRes | undefined>;
  /** Limpia `error`, `data` y `loading`. */
  reset: () => void;
  /** Marca la mutación como fallida con `message` (para validaciones hechas en el cliente, sin llamar al servidor). */
  fail: (message: string) => void;
  loading: boolean;
  error: string;
  /** Respuesta de la última ejecución exitosa (hasta el próximo `run`/`reset`). */
  data: TRes | null;
  /** Argumentos de la ejecución en curso (`undefined` si no hay ninguna). Sirve para saber *qué fila* se está guardando. */
  variables: TVars | undefined;
};

/**
 * Envuelve una operación async (normalmente una llamada de `api`) y expone su
 * estado de `loading / error / data`.
 *
 *   const pagar = useMutation((v: RegistrarPagoBody) => api.post<RegistrarPagoResponse>(url, v));
 *   const res = await pagar.run({ monto: 30, metodo_pago: "EFECTIVO" });
 *   if (!res) return;                  // falló: pagar.error tiene el mensaje
 */
export function useMutation<TVars = void, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  options: UseMutationOptions = {}
): UseMutationResult<TVars, TRes> {
  const { errorMessage = "No se pudo completar la operación." } = options;
  const [state, setState] = useState<MutationState<TVars, TRes>>({
    loading: false,
    error: "",
    data: null,
    variables: undefined,
  });

  // Siempre se ejecuta la versión más reciente de `fn` (sus closures al día).
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runId = useRef(0);

  const run = useCallback(
    async (vars: TVars): Promise<TRes | undefined> => {
      const id = ++runId.current;
      setState({ loading: true, error: "", data: null, variables: vars });
      try {
        const data = await fnRef.current(vars);
        if (mounted.current && id === runId.current) {
          setState({ loading: false, error: "", data, variables: undefined });
        }
        return data;
      } catch (err) {
        if (mounted.current && id === runId.current) {
          setState({ loading: false, error: getErrorMessage(err, errorMessage), data: null, variables: undefined });
        }
        return undefined;
      }
    },
    [errorMessage]
  );

  const reset = useCallback(() => {
    runId.current++;
    setState({ loading: false, error: "", data: null, variables: undefined });
  }, []);

  const fail = useCallback((message: string) => {
    runId.current++;
    setState({ loading: false, error: message, data: null, variables: undefined });
  }, []);

  return { run, reset, fail, ...state };
}
