"use client";

import { useEffect, useState } from "react";

/**
 * Botón para alternar entre tema claro y oscuro (DEV-194).
 *
 * Agrega o quita la clase `dark` en <html> y recuerda la preferencia en
 * localStorage. El estado inicial lo aplica el script inline de
 * app/layout.tsx ANTES de pintar, para que no haya parpadeo blanco al cargar.
 *
 * Los colores salen de las variables CSS del tema (var(--surface),
 * var(--border), var(--text), var(--accent)), que se redefinen bajo
 * `:root.dark` en globals.css, así el botón también se adapta al tema.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Al montar, sincroniza el estado del botón con la clase real del <html>
  // (que el script inline ya puso según la preferencia guardada).
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* localStorage puede fallar en modo privado: no es crítico. */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={dark ? "Tema claro" : "Tema oscuro"}
      className="no-print fixed bottom-4 right-4 z-[500] flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] cursor-pointer transition-colors hover:bg-[var(--surface2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
      {dark ? "Claro" : "Oscuro"}
    </button>
  );
}