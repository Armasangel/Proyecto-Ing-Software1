import type { Metadata } from "next";
import './globals.css'
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Tienda San Miguel — Gestión de Inventario",
  description: "Sistema de gestión de inventario y ventas para distribuidoras agrícolas",
};

// Script que corre ANTES de pintar (DEV-194): aplica el tema guardado (o la
// preferencia del sistema) agregando la clase `dark` a <html> de una vez, para
// que no se vea un parpadeo blanco al cargar en modo oscuro.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var usarOscuro = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (usarOscuro) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}