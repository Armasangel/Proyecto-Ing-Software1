// components/ErrorScreen.tsx
//
// Pantalla de error compartida por las tres fronteras de App Router:
//   - app/error.tsx        → crash de render en una página o ruta
//   - app/global-error.tsx → crash en el root layout
//   - app/not-found.tsx    → 404
//
// No lleva "use client" a propósito: así `not-found.tsx` (server component)
// puede renderizarla en el servidor, mientras que los error boundaries la
// importan desde el grafo cliente. Solo recibe handlers opcionales que le
// pasan los padres, y no usa hooks ni estado.

import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

export type ErrorScreenProps = {
  titulo: string;
  descripcion: string;
  /** Identificador que correlaciona el error con la línea del log del servidor. */
  digest?: string;
  /** Si se pasa, muestra el botón de reintento. `reset()` de App Router. */
  onRetry?: () => void;
  /** Texto del botón de reintento. */
  retryLabel?: string;
  /** Destino del enlace secundario. Por defecto, el home. */
  inicioHref?: string;
  inicioLabel?: string;
  icono?: IconName;
};

export function ErrorScreen({
  titulo,
  descripcion,
  digest,
  onRetry,
  retryLabel = "Reintentar",
  inicioHref = "/",
  inicioLabel = "Ir al inicio",
  icono = "close",
}: ErrorScreenProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-cream font-body p-6">
      <div className="w-full max-w-lg rounded-card border border-[var(--border)] bg-white shadow-warm p-9 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-achiote-50 border border-achiote/20 flex items-center justify-center">
          <Icon name={icono} size={28} color="#E1592A" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-head text-xl font-bold text-ink">{titulo}</h1>
          <p className="text-sm text-ink-muted leading-relaxed">{descripcion}</p>
        </div>

        {digest && (
          <p className="text-xs text-ink-faint font-mono break-all">
            Código de seguimiento: <span className="text-ink-muted">{digest}</span>
          </p>
        )}

        <div className="flex items-center gap-3 mt-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-5 py-2.5 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110"
            >
              {retryLabel}
            </button>
          )}

          <Link
            href={inicioHref}
            className="px-5 py-2.5 rounded-control bg-transparent border border-market text-market-600 font-semibold text-sm transition-transform active:scale-[0.97] hover:bg-market-50"
          >
            {inicioLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
