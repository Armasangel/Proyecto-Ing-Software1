import { Writable } from "stream";
import { createLogger, getLogger, resolveLogLevel } from "@/lib/logger";

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