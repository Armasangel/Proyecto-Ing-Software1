// @ts-ignore -- next.config.mjs es JavaScript y no trae declaración de tipos
import nextConfig from "../../next.config.mjs";

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

const NODE_ENV_ORIGINAL = process.env.NODE_ENV;

/**
 * `process.env.NODE_ENV` es de solo lectura en los tipos de Next, pero
 * `next.config.mjs` lo lee en runtime para decidir si manda HSTS. El cast es
 * la vía estándar para simular el entorno en un test.
 */
function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

/** Ejecuta `headers()` y devuelve las reglas como mapa clave → valor. */
async function obtenerHeaders() {
  const rules: HeaderRule[] = await nextConfig.headers!();
  expect(rules).toHaveLength(1);
  return {
    source: rules[0].source,
    headers: Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value])),
  };
}

describe("next.config.mjs (DEV-127: headers de seguridad)", () => {
  afterEach(() => {
    setNodeEnv(NODE_ENV_ORIGINAL!);
  });

  it("desactiva el header X-Powered-By para no revelar que el backend es Next.js", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("aplica los headers a todas las rutas, no solo a la API", async () => {
    // `/:path*` cubre tanto las páginas del sistema (donde hay sesión
    // iniciada) como las respuestas de `/api/*`. Proteger solo la API
    // dejaría el clickjacking sin cubrir justamente en el HTML.
    const { source } = await obtenerHeaders();
    expect(source).toBe("/:path*");
  });

  it("envía los headers base con o sin HSTS", async () => {
    const { headers } = await obtenerHeaders();
    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("omite HSTS fuera de producción para no cachear el max-age en dev", async () => {
    setNodeEnv("development");
    const { headers } = await obtenerHeaders();
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });

  it("omite HSTS en test (NODE_ENV=test es el default de la suite)", async () => {
    const { headers } = await obtenerHeaders();
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });

  it("envía HSTS en producción, que es donde Nginx + Certbot sirven por TLS", async () => {
    setNodeEnv("production");
    const { headers } = await obtenerHeaders();
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains"
    );
  });

  it("mantiene los headers base junto al HSTS en producción", async () => {
    setNodeEnv("production");
    const { headers } = await obtenerHeaders();
    // HSTS no debe reemplazarlos: es un header más, no un caso aparte.
    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
  });
});
