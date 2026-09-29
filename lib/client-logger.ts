// lib/client-logger.ts
//
// Logger para el código que corre en el navegador.
//
// ¿Por qué no usar `lib/logger.ts` en el cliente? Porque ese módulo importa
// `rotating-file-stream`, que depende de `fs` de Node. Si un client component
// lo importa, `next build` intenta meter `fs` en el bundle del navegador y
// revienta. Pino tampoco se inicializa igual en los dos entornos.
//
// Reglas de uso (ver la sección de Logging en CONTRIBUTING.md):
//   - Servidor  → `lib/logger.ts` (pino, NDJSON, archivo rotado).
//   - Cliente   → este módulo. Es el ÚNICO archivo del proyecto autorizado a
//                 llamar `console.*` (override de `no-console` en
//                 .eslintrc.json).
//
// Cuando el error venga de un error boundary de App Router, pasá también el
// `digest`: es el identificador que correlaciona este error con la línea
// correspondiente del log del servidor.
//
//   logClientError("Error al renderizar", error, { digest: error.digest });

export type ClientLogContext = Record<string, unknown>;

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
};

/**
 * Normaliza cualquier valor lanzado a un objeto plano serializable.
 * Un error boundary puede recibir cualquier cosa desde `throw "texto"`, así que
 * no se puede asumir que sea una instancia de `Error`.
 */
export function serializarError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { name: "NoError", message: String(error) };
}

/**
 * Registra un error ocurrido en el navegador.
 *
 * Nunca lanza: si falla la serialización o `console` está pisado, el error se
 * traga. Un logger que rompe la app es peor que un logger que no reporta.
 */
export function logClientError(
  message: string,
  error?: unknown,
  context?: ClientLogContext
): void {
  try {
    const detalle: Record<string, unknown> = {
      ...(error !== undefined ? { err: serializarError(error) } : {}),
      ...context,
    };

    console.error(`[cliente] ${message}`, detalle);
  } catch {
    // Sin logging del propio fallo del logger: emitirlo otra vez por la misma
    // vía que acaba de fallar solo genera ruido.
  }
}
