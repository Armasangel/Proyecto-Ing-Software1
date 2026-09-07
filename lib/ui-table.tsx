import type { CSSProperties } from "react";

export type PageSize = number;

export const PAGE_SIZES: PageSize[] = [10, 25, 50];
export const PAGE_SIZES_COMPACT: PageSize[] = [10, 50];

export function matchesQuery(query: string, ...campos: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return campos.some((c) => String(c ?? "").toLowerCase().includes(q));
}

export function paginar<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage) || 1);
  const paginaSegura = Math.min(Math.max(1, page), totalPaginas);
  const inicio = (paginaSegura - 1) * perPage;
  return {
    slice: items.slice(inicio, inicio + perPage),
    total,
    totalPaginas,
    paginaSegura,
    totalPages: totalPaginas,
    safePage: paginaSegura,
  };
}

type PaginationBarStyles = {
  container: CSSProperties;
  meta: CSSProperties;
  controls: CSSProperties;
  sizeLabel: CSSProperties;
  select: CSSProperties;
  btn: CSSProperties;
  page: CSSProperties;
};

const estilosDeudas: PaginationBarStyles = {
  container: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.75rem",
    borderTop: "1px solid var(--border)",
  },
  meta: { color: "var(--muted)", fontSize: "0.82rem" },
  controls: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  sizeLabel: { display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--muted)", fontSize: "0.82rem" },
  select: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.4rem",
    color: "var(--text)",
    fontSize: "0.82rem",
  },
  btn: {
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    borderRadius: 6,
    padding: "0.3rem 0.7rem",
    fontSize: "0.82rem",
  },
  page: { fontSize: "0.82rem", color: "var(--muted)", minWidth: 60, textAlign: "center" },
};

const estilosInventario: PaginationBarStyles = {
  container: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.75rem 0.85rem",
    borderTop: "1px solid var(--border)",
    background: "var(--surface2)",
  },
  meta: { color: "var(--muted)", fontSize: "0.82rem" },
  controls: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  sizeLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    color: "var(--muted)",
    fontSize: "0.82rem",
    userSelect: "none",
  } as CSSProperties,
  select: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.4rem 0.5rem",
    color: "var(--text)",
    fontSize: "0.82rem",
    outline: "none",
    minWidth: 72,
  },
  btn: {
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    borderRadius: 8,
    padding: "0.4rem 0.75rem",
    fontSize: "0.82rem",
    whiteSpace: "nowrap",
  } as CSSProperties,
  page: { fontSize: "0.82rem", color: "var(--muted)", minWidth: 72, textAlign: "center" } as CSSProperties,
};

export function PaginationBar({
  total,
  page,
  perPage,
  onPage,
  onPerPage,
  noun,
  pageSizes = PAGE_SIZES,
  variant = "deudas",
}: {
  total: number;
  page: number;
  perPage: PageSize;
  onPage: (p: number) => void;
  onPerPage: (n: PageSize) => void;
  noun: string;
  pageSizes?: PageSize[];
  variant?: "deudas" | "inventario";
}) {
  const st = variant === "inventario" ? estilosInventario : estilosDeudas;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage) || 1);
  const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
  const hasta = Math.min(page * perPage, total);
  const sinAnterior = page <= 1;
  const sinSiguiente = page >= totalPaginas || total === 0;

  return (
    <div style={st.container} role="navigation" aria-label="Paginación">
      <span style={st.meta}>
        {total === 0 ? `Sin ${noun}` : `Mostrando ${desde}–${hasta} de ${total} ${noun}`}
      </span>
      <div style={st.controls}>
        <label style={st.sizeLabel}>
          Por página
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            style={st.select}
            aria-label="Resultados por página"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={sinAnterior}
          aria-label="Página anterior"
          style={{ ...st.btn, cursor: sinAnterior ? "not-allowed" : "pointer", opacity: sinAnterior ? 0.45 : 1 }}
        >
          Anterior
        </button>
        <span style={st.page} aria-live="polite">
          {page} / {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={sinSiguiente}
          aria-label="Página siguiente"
          style={{ ...st.btn, cursor: sinSiguiente ? "not-allowed" : "pointer", opacity: sinSiguiente ? 0.45 : 1 }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}