// app/error.tsx
//
// Frontera de error del segmento raíz. Next.js la renderiza cuando una página
// o un route handler lanza durante el render, en lugar de dejar al usuario
// frente a la pantalla en blanco que describía la guía de hosting.
//
// No captura los errores del root layout: para eso está app/global-error.tsx.
//
// El `digest` que entrega Next.js es la pieza clave de esta pantalla. Es el
// identificador que permite correlacionar lo que ve el usuario en el navegador
// con la línea exacta que sí quedó registrada en el log del servidor:
//
//   pm2 logs tienda-san-miguel --lines 30 --nostream   # producción (PM2)
//   scripts/logs.sh errors                              # desarrollo (Docker)

"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { logClientError } from "@/lib/client-logger";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("Error al renderizar la página", error, { digest: error.digest });
  }, [error]);

  return (
    <ErrorScreen
      titulo="Algo salió mal en esta pantalla"
      descripcion="La página no se pudo mostrar. Podés reintentarlo; si el problema sigue, avisale al dueño del sistema."
      digest={error.digest}
      onRetry={reset}
    />
  );
}
