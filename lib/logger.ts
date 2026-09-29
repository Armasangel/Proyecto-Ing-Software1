// lib/logger.ts
//
// Sistema de logging central basado en pino (https://getpino.io).
// Salida:
//   - Producción: NDJSON puro a stdout (lo consume `docker compose logs
//     / `docker logs`). Con `docker compose logs -f app | npm run logs` se
//     ve formateado (pino-pretty).
//   - Desarrollo: transport `pino-pretty` (legible humano).
//   - Tests (NODE_ENV=test): nivel `silent` por defecto para no ensuciar la
//     salida de jest. Los tests que _sí_ quieren verificar logs instancian
//     su propio logger con `createLogger({ destination })`.
//
// Persistencia (opcional): si `LOG_FILE_DIR` está definido (fuera de test),
// el logger además escribe a un archivo rotado por tamaño dentro de ese
// directorio (ver `createRotatedFileStream`). En Docker se monta un volumen
// sobre ese directorio para que los logs sobrevivan a los recreos del
// contenedor. El stdout se mantiene SIEMPRE (multistream), así que
// `docker compose logs` y `pm2 logs` siguen funcionando igual.
//
// Niveles (pino): error > warn > info > debug > trace.
// El nivel por entorno se puede sobreescribir con `LOG_LEVEL`.

import pino, { type Logger, type LoggerOptions, type DestinationStream, type StreamEntry } from "pino";
import { createStream as createRotatingStream } from "rotating-file-stream";

export const APP_NAME = "tienda-san-miguel";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

export type FileLogOptions = {
  /** Directorio donde se escriben los archivos rotados. */
  dir: string;
  /** Tamaño máximo por archivo (p. ej. "50M", "10m", "1G"). */
  maxSize?: string;
  /** Cantidad de archivos rotados a conservar (sin contar el activo). */
  maxFiles?: number;
  /** Comprimir los archivos rotados con gzip. */
  compress?: boolean;
};

/** Rotación por defecto: 50 MB por archivo, conservar 5, comprimir con gzip. */
const DEFAULT_FILE_MAX_SIZE = "50M";
const DEFAULT_FILE_MAX_FILES = 5;

/** Campos que nunca deben aparecer en texto plano en los logs. */
const REDACT_PATHS = [
  "password",
  "contrasena",
  "contrasena_hash",
  "authorization",
  "cookie",
  "auth_token",
  "token",
  "jwt",
  "GMAIL_APP_PASSWORD",
  "JWT_SECRET",
];

/**
 * Destino de pino que escribe a un archivo rotado por tamaño usando
 * `rotating-file-stream`. Devuelve un `DestinationStream` listo para pasar a
 * `createLogger({ destination })` o a `pino.multistream`.
 */
export function createRotatedFileStream(options: FileLogOptions): DestinationStream {
  const { dir, maxSize = DEFAULT_FILE_MAX_SIZE, maxFiles = DEFAULT_FILE_MAX_FILES, compress = true } = options;
  return createRotatingStream("server.log", {
    path: dir,
    size: maxSize,
    maxFiles,
    compress,
  }) as unknown as DestinationStream;
}

/** Lee la configuración de archivo desde el entorno, si está activada. */
export function fileLogOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): FileLogOptions | undefined {
  if (env.NODE_ENV === "test") return undefined;
  if (!env.LOG_FILE_DIR) return undefined;
  return {
    dir: env.LOG_FILE_DIR,
    maxSize: env.LOG_FILE_MAX_SIZE || DEFAULT_FILE_MAX_SIZE,
    maxFiles: env.LOG_FILE_KEEP ? Number(env.LOG_FILE_KEEP) : DEFAULT_FILE_MAX_FILES,
  };
}

function isLogLevel(value: string | undefined): value is LogLevel {
  return !!value && (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Decide el nivel de logs según `LOG_LEVEL` o el entorno:
 *   - `LOG_LEVEL` definido y válido → siempre gana (permite forzar logs
 *     incluso en CI/tests).
 *   - NODE_ENV=test → silent (jest limpio por defecto).
 *   - NODE_ENV=production → info.
 *   - Cualquier otro entorno (development…) → debug.
 */
export function resolveLogLevel(
  env: NodeJS.ProcessEnv = process.env
): LogLevel {
  if (isLogLevel(env.LOG_LEVEL)) return env.LOG_LEVEL;
  if (env.NODE_ENV === "test") return "silent";
  if (env.NODE_ENV === "production") return "info";
  return "debug";
}

export type CreateLoggerOptions = {
  /** Nivel mínimo a emitir. Por defecto `resolveLogLevel()` con el entorno. */
  level?: LogLevel;
  /** Forzar transport `pino-pretty` (solo desarrollo). */
  pretty?: boolean;
  /** Destino de escritura (por defecto stdout). Útil en tests. */
  destination?: DestinationStream;
  /**
   * Persistencia opcional en archivo rotado. Si está definido y NO se pasó
   * `destination`, el logger escribe a stdout Y al archivo (multistream).
   */
  file?: FileLogOptions | false;
  /** Bindings base de cada log (p. ej. `{ service }`). */
  base?: LoggerOptions["base"];
  redact?: LoggerOptions["redact"];
};

/**
 * Fábrica pura: permite crear un logger aislado (tests) o el singleton de la
 * app. En desarrollo (NODE_ENV=development, fuera de jest) activa
 * `pino-pretty` vía transport en worker thread. Con `file` activo, además de
 * stdout escribe a un archivo rotado (ver `LOG_FILE_DIR`).
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const isTest = process.env.NODE_ENV === "test";
  const pretty =
    options.pretty ??
    (process.env.NODE_ENV === "development" && !isTest);
  const file =
    options.file !== undefined
      ? options.file
      : isTest
        ? false
        : fileLogOptionsFromEnv();
  const redact: LoggerOptions["redact"] =
    options.redact ?? { paths: REDACT_PATHS, censor: "[REDACTED]" };

  const loggerOptions: LoggerOptions = {
    level: options.level ?? resolveLogLevel(),
    base: options.base ?? { app: APP_NAME },
    redact,
  };

  // Si hay un `destination` explícito (tests), se usa tal cual, sin archivo.
  if (options.destination) {
    return pino(loggerOptions, options.destination);
  }

  // Persistencia en archivo rotado: multistream = stdout (NDJSON crudo, para
  // que `docker compose logs -f app | npm run logs` siga igual) + archivo.
  if (file) {
    const streams: StreamEntry[] = [
      { stream: process.stdout },
      { stream: createRotatedFileStream(file) },
    ];
    return pino(loggerOptions, pino.multistream(streams));
  }

  if (pretty) {
    loggerOptions.transport = {
      target: "pino-pretty",
      options: {
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
        colorize: true,
      },
    };
  }

  return pino(loggerOptions, options.destination);
}

declare global {
  // HMR de Next dev puede re-importar el módulo: cachear el singleton.
  // eslint-disable-next-line no-var
  var __dsmLogger: Logger | undefined;
}

/** Logger global de la app. Importá este singleton (o `getLogger(...)`). */
export const logger: Logger = globalThis.__dsmLogger ?? (globalThis.__dsmLogger = createLogger());

/**
 * Logger hijo etiquetado con el módulo que lo emite, ej.:
 *   const log = getLogger("api/ventas");
 *   log.info({ id_venta }, "Venta creada");
 */
export function getLogger(module: string): Logger {
  return logger.child({ module });
}