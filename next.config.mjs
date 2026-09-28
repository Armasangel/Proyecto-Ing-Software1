/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evita exponer el header "X-Powered-By: Next.js"
  poweredByHeader: false,
  // Headers de seguridad estándar aplicados a todas las rutas de la API (DEV-127)
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;