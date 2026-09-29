import { Writable } from "stream";
import fs from "fs";
import os from "os";
import path from "path";
import pino from "pino";
import {
  createLogger,
  createRotatedFileStream,
  fileLogOptionsFromEnv,
  getLogger,
  resolveLogLevel,
} from "@/lib/logger";

type Sink = { stream: Writable; lines: string[] };

function makeSink(): Sink {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _enc: string, cb: () => void) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { stream, lines };
}

/** Pino escribe de forma asíncrona a destinations custom: damos tiempo a que drene. */
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 5));
}

/** Espera (poliando) a que haya al menos `min` archivos en `dir`. */
async function waitForFileCount(dir: string, min: number, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = fs.readdirSync(dir).filter((f) => f.startsWith("server.log")).length;
    if (count >= min) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`No se alcanzaron ${min} archivos de log en ${timeoutMs}ms`);
}

describe("createLogger", () => {
  it("emite NDJSON con level, time y msg", async () => {
    const sink = makeSink();
    const log = createLogger({ level: "info", destination: sink.stream });
    log.info("hola");
    await settle();

    expect(sink.lines).toHaveLength(1);
    const parsed = JSON.parse(sink.lines[0]);
    expect(parsed.level).toBe(30); // pino: info = 30
    expect(parsed.msg).toBe("hola");
    expect(typeof parsed.time).toBe("number");
  });

  it("incluye los bindings pasados en el mensaje", async () => {
    const sink = makeSink();
    const log = createLogger({ level: "info", destination: sink.stream });
    log.info({ id_usuario: 5, modulo: "ventas" }, "venta creada");
    await settle();

    const parsed = JSON.parse(sink.lines[0]);
    expect(parsed.id_usuario).toBe(5);
    expect(parsed.modulo).toBe("ventas");
  });

  it("filtra por nivel mínimo (warn descarta debug e info)", async () => {
    const sink = makeSink();
    const log = createLogger({ level: "warn", destination: sink.stream });
    log.debug("debug no");
    log.info("info no");
    log.warn("warn sí");
    log.error("error sí");
    await settle();

    const msgs = sink.lines.map((l) => JSON.parse(l).msg as string);
    expect(msgs).toEqual(["warn sí", "error sí"]);
  });

  it("serializa errores con stack y type al pasar { err }", async () => {
    const sink = makeSink();
    const log = createLogger({ level: "error", destination: sink.stream });
    log.error({ err: new Error("boom") }, "fallo en DB");
    await settle();

    const parsed = JSON.parse(sink.lines[0]);
    expect(parsed.msg).toBe("fallo en DB");
    expect(parsed.err.type).toBe("Error");
    expect(parsed.err.message).toBe("boom");
    expect(parsed.err.stack).toContain("boom");
  });

  it("redacta campos sensibles antes de escribir", async () => {
    const sink = makeSink();
    const log = createLogger({
      level: "info",
      destination: sink.stream,
      redact: { paths: ["password", "token"], censor: "[REDACTED]" },
    });
    log.info({ password: "secreta", token: "abc123", user: "ana" }, "login");
    await settle();

    const parsed = JSON.parse(sink.lines[0]);
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.user).toBe("ana");
  });
});

describe("resolveLogLevel", () => {
  it("devuelve silent en NODE_ENV=test sin LOG_LEVEL", () => {
    expect(resolveLogLevel({ NODE_ENV: "test" })).toBe("silent");
  });

  it("devuelve info en production", () => {
    expect(resolveLogLevel({ NODE_ENV: "production" })).toBe("info");
  });

  it("devuelve debug en development", () => {
    expect(resolveLogLevel({ NODE_ENV: "development" })).toBe("debug");
  });

  it("LOG_LEVEL válido tiene prioridad incluso en test", () => {
    expect(resolveLogLevel({ NODE_ENV: "test", LOG_LEVEL: "info" })).toBe("info");
    expect(resolveLogLevel({ NODE_ENV: "production", LOG_LEVEL: "debug" })).toBe("debug");
  });

  it("LOG_LEVEL inválido cae al default del entorno", () => {
    expect(resolveLogLevel({ NODE_ENV: "production", LOG_LEVEL: "chatty" })).toBe("info");
  });
});

describe("getLogger", () => {
  it("crea un child logger etiquetado con el módulo", async () => {
    const sink = makeSink();
    const base = createLogger({ level: "info", destination: sink.stream });
    const child = base.child({ module: "api/ventas" });
    child.info("venta registrada");
    await settle();

    const parsed = JSON.parse(sink.lines[0]);
    expect(parsed.module).toBe("api/ventas");
  });

  it("expone el logger singleton con todos los niveles", () => {
    const log = getLogger("api/x");
    for (const method of ["trace", "debug", "info", "warn", "error", "fatal", "child"]) {
      expect(typeof (log as unknown as Record<string, unknown>)[method]).toBe("function");
    }
  });
});

describe("persistencia en archivo rotado", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsm-log-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("escribe NDJSON a un archivo y rota al superar el tamaño", async () => {
    const stream = createRotatedFileStream({ dir: tmpDir, maxSize: "20B", maxFiles: 2, compress: false });
    const log = pino({ level: "info" }, stream);

    for (let i = 0; i < 60; i++) {
      log.info({ i }, "línea de prueba número " + i);
    }
    await log.flush(); // drena el buffer de pino hacia el stream

    // Cierra el stream para que termine las rotaciones pendientes antes de
    // borrar el directorio temporal (evita renames colgados/ENOENT).
    await new Promise<void>((resolve) => {
      stream.once("error", () => resolve());
      stream.end(() => resolve());
    });
    await new Promise((r) => setTimeout(r, 25));
    await waitForFileCount(tmpDir, 2);

    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".log"));
    expect(files.length).toBeGreaterThan(1);

    const contenido = files.map((f) => fs.readFileSync(path.join(tmpDir, f), "utf8")).join("\n");
    expect(contenido).toContain('"level":30'); // NDJSON válido de pino
    expect(files.length).toBeLessThanOrEqual(3); // activo + maxFiles
  });

  it("fileLogOptionsFromEnv respeta el entorno y los defaults", () => {
    expect(fileLogOptionsFromEnv({ NODE_ENV: "test", LOG_FILE_DIR: "/x" })).toBeUndefined();
    expect(fileLogOptionsFromEnv({ NODE_ENV: "production" })).toBeUndefined();
    expect(fileLogOptionsFromEnv({ NODE_ENV: "production", LOG_FILE_DIR: "/app/logs" })).toEqual({
      dir: "/app/logs",
      maxSize: "50M",
      maxFiles: 5,
    });
    expect(
      fileLogOptionsFromEnv({ NODE_ENV: "development", LOG_FILE_DIR: "/logs", LOG_FILE_MAX_SIZE: "10M", LOG_FILE_KEEP: "3" })
    ).toEqual({ dir: "/logs", maxSize: "10M", maxFiles: 3 });
  });
});