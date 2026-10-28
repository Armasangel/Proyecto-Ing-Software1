"use client";

import { FC } from "react";

/** Parámetros de la barra de paginación */
export type PaginationBarProps = {
  /** Total de items en el conjunto */
  total: number;
  /** Página actual (1-based) */
  page: number;
  /** Elementos por página */
  perPage: number;
  /** Cambiar de página */
  onPageChange: (p: number) => void;
  /** Cambiar elements por página */
  onPerPageChange: (n: number) => void;
  /** Texto descriptivo ("clientes", "deudas", etc.) */
  noun: string;
  /** Tamaños disponibles del selector "por página" */
  pageSizes?: number[];
  /** Variante visual: "default" muestra "Página X de Y", "compacto" solo prev/next */
  variant?: "default" | "compact";
};

/** Estilos Tailwind generados a partir de las variables CSS del proyecto.
 *  Equivalentes a los estilos inline de /lib/ui-table.tsx pero usando className.
 */
const pageSizesOptions: number[] = [10, 25, 50];

/** Paginación por defecto: prev / "Página X de Y" / next */
export const PaginationBar: FC<PaginationBarProps> = ({
  total,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  noun,
  pageSizes = pageSizesOptions,
  variant = "default",
}) => {
  const totalPages = Math.max(1, Math.ceil(total / perPage) || 1);
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages || total > 0;

  // Clases base consistentes con el diseño del proyecto:
  // bg-cream / text-ink / border-[var(--border)] / rounded-control / shadow-warm
  const btnClass =
    "inline-flex items-center rounded-control border border-[var(--border)] " +
    "bg-cream text-ink font-medium px-3 py-1.5 hover:bg-cream/90 disabled:opacity-60 disabled:cursor-not-allowed";

  const selectClass =
    "rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm " +
    "px-3 py-2 outline-none focus:ring-2 focus:ring-market/40";

  const metaClass =
    "text-ink-muted text-[0.82rem]";

  const labelClass =
    "text-ink-muted text-[0.85rem]";

  return (
    <div className="mt-4 flex items-center gap-3 flex-wrap">
      {/* Etiqueta de rango */}
      <span className={labelClass}>
        {total === 0
          ? `Sin ${noun}`
          : `Mostrando ${from}–${to} de ${total} ${noun}`}
      </span>

      {/* Controles: selector + botones */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Selector "por página" */}
        <label className="text-[0.82rem] text-ink-muted mb-1">
          Por página
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className={selectClass}
            aria-label="Resultados por página"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Botón Prev */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className={`
            ${btnClass}
            ${!hasPrev && "opacity-40 cursor-not-allowed"}
          `}
          aria-label="Página anterior"
        >
          Anterior
        </button>

        {/* Número de página */}
        {variant === "default" && (
          <span
            className="ml-2 text-ink-muted text-[0.88rem]"
            aria-live="polite"
          >
            Página {page} de {totalPages}
          </span>
        )}

        {/* Botón Next */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className={`
            ${btnClass}
            ${!hasNext && "opacity-40 cursor-not-allowed"}
          `}
          aria-label="Página siguiente"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;