import * as React from "react";

/** Hook de estado de paginación unificado.
 *
 * Deriva `page`, `perPage`, `totalPages`, `hasMore`, `nextPage`, `prevPage`
 * de la meta de la API: `{ total, page, limit, totalPages }`.
 *
 * Props:
 *   - initialPage: página inicial (default 1)
 *   - initialPerPage: elementos por página inicial (default del API: 50)
 *   - onPageChange: callback cuando cambia la página (se envaja el ?page al API)
 *   - onPerPageChange: callback cuando cambia el "por página" (se envaja ?limit al API)
 *
 * Returns:
 *   - page, perPage, totalPages, hasMore
 *   - nextPage, prevPage
 *   - setPage, setPerPage
 */
export function usePagination(params: {
  /** Meta traída del API: { total, page, limit, totalPages } */
  meta: { total: number; page: number; limit: number; totalPages: number };
  /** Página inicial */
  initialPage?: number;
  /** Elementos por página inicial */
  initialPerPage?: number;
  /** Called cuando el usuario hace clic en "Siguiente/Anterior" o selecciona página */
  onPageChange?: (page: number) => void;
  /** Called cuando el usuario selecciona un nuevo "por página" */
  onPerPageChange?: (perPage: number) => void;
}) {
  const { meta, initialPage = 1, initialPerPage = meta.limit, onPageChange, onPerPageChange } = params;

  const [page, setPage] = React.useState<number>(initialPage);
  const [perPage, setPerPage] = React.useState<number>(initialPerPage);

  // Sincronizar con la meta traída del API (solo si cambia el total o la página)
  React.useEffect(() => {
    if (meta.total !== undefined) {
      const computedTotalPages = Math.max(1, Math.ceil(meta.total / meta.limit) || 1);
      // Si la página actual excede el total de páginas, la ajustamos
      setPage(Math.min(meta.page, computedTotalPages));
      setPerPage(meta.limit);
    }
  }, [meta]);

  const totalPages = Math.max(1, Math.ceil(meta.total / perPage) || 1);
  const hasMore = page < totalPages;
  const nextPage = page < totalPages ? page + 1 : null;
  const prevPage = page > 1 ? page - 1 : null;

  return {
    page,
    perPage,
    totalPages,
    hasMore,
    nextPage,
    prevPage,
    setPage,
    setPerPage,
    // Convenientes
    goNext: () => {
      if (hasMore) setPage(page + 1);
    },
    goPrev: () => {
      if (prevPage !== null) setPage(prevPage);
    },
  };
}