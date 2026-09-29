// app/not-found.tsx
//
// 404 de la app. Server component: hereda el root layout, así que no necesita
// re-declarar <html>/<head> ni las fuentes como sí hace app/global-error.tsx.

import { ErrorScreen } from "@/components/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      titulo="Página no encontrada"
      descripcion="La dirección que abriste no existe o cambió de lugar. Revisá el enlace o volvé al inicio."
      inicioHref="/login"
      inicioLabel="Ir al login"
      icono="box"
    />
  );
}
