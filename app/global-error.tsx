// app/global-error.tsx
//
// Última frontera: captura los errores del ROOT LAYOUT, que app/error.tsx no
// alcanza. Es la única que evita la pantalla totalmente en blanco cuando falla
// app/layout.tsx (el que envuelve toda la app en <html>).
//
// Next.js reemplaza el layout por completo cuando renderiza este archivo, así
// que tiene que incluir sus propios <html>, <head> y <body>. Por eso se
// re-declaran aquí los links de Google Fonts: sin ellos, la pantalla de error
// perdería la tipografía del sistema (Syne / DM Sans).

"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { logClientError } from "@/lib/client-logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("Error en el layout raíz", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorScreen
          titulo="El sistema no pudo arrancar"
          descripcion="Ocurrió un problema más general al cargar la aplicación. Reintentá; si sigue fallando, hay que reiniciar el servicio en el servidor."
          digest={error.digest}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
