import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tienda San Miguel",
  description: "Sistema de Gestión de Inventario y Ventas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}