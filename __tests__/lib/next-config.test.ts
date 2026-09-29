// @ts-ignore -- next.config.mjs es JavaScript y no trae declaración de tipos
import nextConfig from "../../next.config.mjs";

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

describe("next.config.mjs (DEV-127: headers de seguridad de la API)", () => {
  it("desactiva el header X-Powered-By para no revelar que el backend es Next.js", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("aplica los cuatro headers de seguridad estándar a /api/:path*", async () => {
    const rules: HeaderRule[] = await nextConfig.headers!();

    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/api/:path*");

    const headers = Object.fromEntries(
      rules[0].headers.map((h) => [h.key, h.value])
    );

    expect(headers).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    });
  });
});
