/** Unified pagination across the entire project.
  *
  * Method: page (1-based) + limit (clamped max).
  * Every response includes: total, page, limit, totalPages.
  * hasMore is derived: page >= totalPages.
  *
  * Params accepted from ?page and ?limit query strings.
  * `offset` is NOT supported — use page navigation only.
  *
  * Design:
  *   fetchLimit = limit + 1  →  hasMore = fetchedRows > limit
  *   totalPages = ceil(total / limit)
  *   nextPage = page + 1  (if page < totalPages)
  *   prevPage = page - 1  (if page > 1)
  */

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 200;

export type PaginationParams = {
  /** 1-based page number, minimum 1 */
  page: number;
  /** Effective limit per page, clamped to [1, MAX_LIMIT] */
  limit: number;
  /** Computed offset: (page - 1) * limit */
  offset: number;
  /** limit + 1, used in SQL to detect if there's a next page without a separate COUNT */
  fetchLimit?: number;
};

export type PaginationMeta = {
  /** Total number of items in the full result set */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Effective limit per page */
  limit: number;
  /** Total number of pages, ceil(total / limit) */
  totalPages: number;
  /** Shorthand: page >= totalPages */
  hasMore: boolean;
  /** Next page offset (page + 1), or null if on last page */
  nextPage: number | null;
  /** Previous page offset (page - 1), or null if on first page */
  prevPage: number | null;
};

/** Parse ?page and ?limit from URLSearchParams with clamping.
 *  Returns default values when params are absent or invalid.
 *
 *  @param sp          URLSearchParams from req.nextUrl.searchParams
 *  @param options     optional overrides for defaults/max
 *  @returns           normalized PaginationParams
 */
export function parsePaginationParams(
  sp: URLSearchParams,
  options?: {
    /** Default limit if ?limit is missing or invalid. Default: 50 */
    defaultLimit?: number;
    /** Maximum allowed limit. Default: 200 */
    maxLimit?: number;
  }
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? PAGINATION_DEFAULT_LIMIT;
  const maxLimit = options?.maxLimit ?? PAGINATION_MAX_LIMIT;

  // Parse page (1-based)
  let page = 1;
  const rawPage = sp.get("page");
  if (rawPage !== null && rawPage !== "") {
    const p = Number(rawPage);
    if (Number.isInteger(p) && p >= 1) page = p;
    // if invalid, stay at 1
  }

  // Parse limit with clamping
  let limit = defaultLimit;
  const rawLimit = sp.get("limit");
  if (rawLimit !== null && rawLimit !== "") {
    const l = Number(rawLimit);
    if (Number.isFinite(l) && l >= 1) {
      limit = Math.min(Math.max(l, 1), maxLimit);
    }
  }

  const offset = (page - 1) * limit;
  const fetchLimit = limit + 1;

  return { page, limit, offset, fetchLimit };
}

/** Build pagination metadata from the full result set count and parsed params.
 *
 *  @param total       FROM `SELECT COUNT(*)` query
 *  @param params      Output of parsePaginationParams
 *  @returns           PaginationMeta with totalPages, hasMore, nextPage, prevPage
 */
export function buildPaginationMeta(total: number, params: PaginationParams, options?: { maxLimit?: number }): PaginationMeta {
  const page = params.page;
  const limit = params.limit;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

/** Return SQL fragment for LIMIT/OFFSET using parameter placeholders,
 *  starting from a given index (for auto-incrementing $1, $2, ...).
 *
 *  Example: limitOffsetSql(1) → { sql: "LIMIT $1 OFFSET $2", limitIndex: 1, offsetIndex: 2 }
 *
 *  @param startIndex  the index to start at (typically 1)
 *  @returns           object with sql string and the two parameter indices
 */
export function limitOffsetSql(startIndex: number = 1): {
  sql: string;
  limitIndex: number;
  offsetIndex: number;
} {
  const limitIdx = startIndex;
  const offsetIdx = startIndex + 1;
  return {
    sql: `LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    limitIndex: limitIdx,
    offsetIndex: offsetIdx,
  };
}

/** Convenience: given a parsed PaginationParams, return the SQL + parameter
 *  indices to append to any SELECT query for pagination.
 *
 *  @param params   Output of parsePaginationParams
 *  @param startIdx first parameter index (default 1)
 *  @returns        { sql, limitIndex, offsetIndex }
 */
export function paginationSql(params: PaginationParams, startIdx: number = 1): {
  sql: string;
  limitIndex: number;
  offsetIndex: number;
} {
  const { limit, offset } = params;
  return limitOffsetSql(startIdx);
}

export default {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  parsePaginationParams,
  buildPaginationMeta,
  limitOffsetSql,
  paginationSql,
};