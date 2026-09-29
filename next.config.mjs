/** @type {import('next').NextConfig} */

// Headers de seguridad estándar (DEV-127).
//
// Se aplican a TODAS las rutas (`/:path*`) y no solo a `/api/*`: el clickjacking
// se ejerce contra el HTML que renderiza el navegador, así que proteger solo las
// respuestas de la API deja sin cubrir justamente las páginas donde hay sesión
// iniciada (ventas, deudas, usuarios). Para la API no cambia nada: sigue
// heredándolos, y `/api/:path*` queda incluido en `/:path*`.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni geolocalización: la 2FA es por correo,
  // no con cámara. Denegarlos por defecto reduce superficie sin costo.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// HSTS solo en producción. Los navegadores ignoran este header cuando llega por
// HTTP simple (RFC 6797), así que mandarlo en desarrollo no rompe nada — pero
// sí deja el `max-age` cacheado si alguien expone la app por HTTPS desde dev.
// En producción es Nginx + Certbot quienes sirven el sitio por TLS.
//
// `includeSubDomains` obliga a los subdominios de tienda-san-miguel.xyz a
// servir HTTPS. Es lo correcto si el dominio es exclusivo de la app; si algún
// día hay un subdominio sin TLS, el navegador lo bloquea y es difícil de
// revertir. Quitarlo es una línea de este archivo.
const HSTS = "max-age=63072000; includeSubDomains";

const nextConfig = {
  reactStrictMode: true,
  // Evita exponer el header "X-Powered-By: Next.js"
  poweredByHeader: false,
  async headers() {
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, { key: "Strict-Transport-Security", value: HSTS }]
        : securityHeaders;

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
