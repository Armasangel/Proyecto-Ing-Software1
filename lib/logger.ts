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
// Niveles (pino): error > warn > info > debug > trace.
// El nivel por entorno se puede sobreescribir con `LOG_LEVEL`.

import pino, { type Logger, type LoggerOptions } from "pino";
import type { DestinationStream } from "pino";

export const APP_NAME = "tienda-san-miguel";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

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
  /** Bindings base de cada log (p. ej. `{ service }`). */
  base?: LoggerOptions["base"];
  redact?: LoggerOptions["redact"];
};

/**
 * Fábrica pura: permite crear un logger aislado (tests) o el singleton de la
 * app. En desarrollo (NODE_ENV=development, fuera de jest) activa
 * `pino-pretty` vía transport en worker thread.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const isTest = process.env.NODE_ENV === "test";
  const pretty =
    options.pretty ??
    (process.env.NODE_ENV === "development" && !isTest);
  const redact: LoggerOptions["redact"] =
    options.redact ?? { paths: REDACT_PATHS, censor: "[REDACTED]" };

  const loggerOptions: LoggerOptions = {
    level: options.level ?? resolveLogLevel(),
    base: options.base ?? { app: APP_NAME },
    redact,
  };

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