import {
  HISTORIAL_VENTAS_DEFAULT_LIMIT,
  HISTORIAL_VENTAS_MAX_LIMIT,
  parseHistorialPagination,
  buildHistorialPaginationMeta,
  historialVentasPeriodosValidos,
  validateHistorialQueryParams,
  historialVentasLikePattern,
  buildHistorialVentasWhere,
} from "@/lib/historial-ventas";

function sp(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

describe("constants", () => {
  it("HISTORIAL_VENTAS_DEFAULT_LIMIT is 50", () => {
    expect(HISTORIAL_VENTAS_DEFAULT_LIMIT).toBe(50);
  });

  it("HISTORIAL_VENTAS_MAX_LIMIT is 200", () => {
    expect(HISTORIAL_VENTAS_MAX_LIMIT).toBe(200);
  });
});

describe("parseHistorialPagination", () => {
  it("returns defaults when no params provided", () => {
    const result = parseHistorialPagination(sp({}));
    expect(result).toEqual({
      limit: 50,
      offset: 0,
      fetchLimit: 51,
    });
  });

  it("caps limit to MAX_LIMIT", () => {
    const result = parseHistorialPagination(sp({ limit: "999" }));
    expect(result.limit).toBe(HISTORIAL_VENTAS_MAX_LIMIT);
    expect(result.fetchLimit).toBe(HISTORIAL_VENTAS_MAX_LIMIT + 1);
  });

  it("uses provided limit when under max", () => {
    const result = parseHistorialPagination(sp({ limit: "25" }));
    expect(result.limit).toBe(25);
    expect(result.fetchLimit).toBe(26);
  });

  it("uses default limit when limit is 0", () => {
    const result = parseHistorialPagination(sp({ limit: "0" }));
    expect(result.limit).toBe(HISTORIAL_VENTAS_DEFAULT_LIMIT);
  });

  it("uses default limit when limit is negative", () => {
    const result = parseHistorialPagination(sp({ limit: "-10" }));
    expect(result.limit).toBe(HISTORIAL_VENTAS_DEFAULT_LIMIT);
  });

  it("uses default limit when limit is non-numeric", () => {
    const result = parseHistorialPagination(sp({ limit: "abc" }));
    expect(result.limit).toBe(HISTORIAL_VENTAS_DEFAULT_LIMIT);
  });

  it("uses default limit when limit is empty string", () => {
    const result = parseHistorialPagination(sp({ limit: "" }));
    expect(result.limit).toBe(HISTORIAL_VENTAS_DEFAULT_LIMIT);
  });

  it("parses offset", () => {
    const result = parseHistorialPagination(sp({ offset: "100" }));
    expect(result.offset).toBe(100);
    expect(result.limit).toBe(HISTORIAL_VENTAS_DEFAULT_LIMIT);
  });

  it("parses offset of 0", () => {
    const result = parseHistorialPagination(sp({ offset: "0" }));
    expect(result.offset).toBe(0);
  });

  it("ignores negative offset (uses 0)", () => {
    const result = parseHistorialPagination(sp({ offset: "-5" }));
    expect(result.offset).toBe(0);
  });

  it("ignores non-numeric offset (uses 0)", () => {
    const result = parseHistorialPagination(sp({ offset: "abc" }));
    expect(result.offset).toBe(0);
  });

  it("parses both limit and offset together", () => {
    const result = parseHistorialPagination(sp({ limit: "20", offset: "40" }));
    expect(result).toEqual({ limit: 20, offset: 40, fetchLimit: 21 });
  });
});

describe("buildHistorialPaginationMeta", () => {
  it("returns nextOffset when hasMore is true", () => {
    const result = buildHistorialPaginationMeta(50, 0, true, 50);
    expect(result).toEqual({
      limit: 50,
      offset: 0,
      hasMore: true,
      nextOffset: 50,
      maxLimit: HISTORIAL_VENTAS_MAX_LIMIT,
    });
  });

  it("returns null nextOffset when hasMore is false", () => {
    const result = buildHistorialPaginationMeta(50, 0, false, 30);
    expect(result.hasMore).toBe(false);
    expect(result.nextOffset).toBeNull();
  });

  it("computes nextOffset from offset + returnedCount", () => {
    const result = buildHistorialPaginationMeta(20, 100, true, 20);
    expect(result.nextOffset).toBe(120);
  });
});

describe("historialVentasPeriodosValidos", () => {
  it("returns day, week, month, year", () => {
    const periods = historialVentasPeriodosValidos();
    expect(periods).toEqual(["day", "week", "month", "year"]);
  });
});

describe("validateHistorialQueryParams", () => {
  it("returns null when no params provided", () => {
    expect(validateHistorialQueryParams(sp({}))).toBeNull();
  });

  it("returns null for valid min_total", () => {
    expect(validateHistorialQueryParams(sp({ min_total: "100" }))).toBeNull();
  });

  it("returns null for min_total of 0", () => {
    expect(validateHistorialQueryParams(sp({ min_total: "0" }))).toBeNull();
  });

  it("rejects negative min_total", () => {
    expect(validateHistorialQueryParams(sp({ min_total: "-5" }))).toBe(
      "min_total inválido"
    );
  });

  it("rejects non-numeric min_total", () => {
    expect(validateHistorialQueryParams(sp({ min_total: "abc" }))).toBe(
      "min_total inválido"
    );
  });

  it("rejects negative max_total", () => {
    expect(validateHistorialQueryParams(sp({ max_total: "-1" }))).toBe(
      "max_total inválido"
    );
  });

  it("rejects min_total > max_total", () => {
    expect(
      validateHistorialQueryParams(sp({ min_total: "200", max_total: "100" }))
    ).toBe("min_total no puede ser mayor que max_total");
  });

  it("accepts min_total == max_total", () => {
    expect(
      validateHistorialQueryParams(sp({ min_total: "100", max_total: "100" }))
    ).toBeNull();
  });

  it("rejects invalid id_producto", () => {
    expect(validateHistorialQueryParams(sp({ id_producto: "0" }))).toBe(
      "id_producto inválido"
    );
    expect(validateHistorialQueryParams(sp({ id_producto: "-1" }))).toBe(
      "id_producto inválido"
    );
    expect(validateHistorialQueryParams(sp({ id_producto: "abc" }))).toBe(
      "id_producto inválido"
    );
  });

  it("accepts valid id_producto", () => {
    expect(validateHistorialQueryParams(sp({ id_producto: "1" }))).toBeNull();
    expect(validateHistorialQueryParams(sp({ id_producto: "999" }))).toBeNull();
  });

  it("rejects invalid id_cliente", () => {
    expect(validateHistorialQueryParams(sp({ id_cliente: "0" }))).toBe(
      "id_cliente inválido"
    );
  });

  it("rejects invalid id_proveedor", () => {
    expect(validateHistorialQueryParams(sp({ id_proveedor: "0" }))).toBe(
      "id_proveedor inválido"
    );
  });

  it("rejects invalid periodo", () => {
    expect(validateHistorialQueryParams(sp({ periodo: "decade" }))).toBe(
      "periodo inválido (use day, week, month o year)"
    );
  });

  it("accepts valid periodo values", () => {
    expect(validateHistorialQueryParams(sp({ periodo: "day" }))).toBeNull();
    expect(validateHistorialQueryParams(sp({ periodo: "week" }))).toBeNull();
    expect(validateHistorialQueryParams(sp({ periodo: "month" }))).toBeNull();
    expect(validateHistorialQueryParams(sp({ periodo: "year" }))).toBeNull();
  });

  it("returns null when empty string params are passed (treated as omitted)", () => {
    expect(
      validateHistorialQueryParams(
        sp({
          min_total: "",
          max_total: "",
          id_producto: "",
          id_cliente: "",
          id_proveedor: "",
          periodo: "",
        })
      )
    ).toBeNull();
  });
});

describe("historialVentasLikePattern", () => {
  it("wraps a simple string in %...%", () => {
    expect(historialVentasLikePattern("juan")).toBe("%juan%");
  });

  it("trims whitespace", () => {
    expect(historialVentasLikePattern("  juan  ")).toBe("%juan%");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(historialVentasLikePattern("   ")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(historialVentasLikePattern("")).toBe("");
  });

  it("escapes backslashes", () => {
    expect(historialVentasLikePattern("test\\path")).toBe("%test\\\\path%");
  });

  it("escapes percent signs", () => {
    expect(historialVentasLikePattern("50%")).toBe("%50\\%%");
  });

  it("escapes underscores", () => {
    expect(historialVentasLikePattern("a_b")).toBe("%a\\_b%");
  });

  it("escapes all special characters together", () => {
    expect(historialVentasLikePattern("100%_of\\total")).toBe(
      "%100\\%\\_of\\\\total%"
    );
  });

  it("handles strings with only special characters", () => {
    expect(historialVentasLikePattern("\\%_")).toBe("%\\\\\\%\\_%");
  });

  it("preserves normal characters", () => {
    expect(historialVentasLikePattern("Hello World")).toBe("%Hello World%");
  });
});

describe("buildHistorialVentasWhere", () => {
  it("returns TRUE when no params are provided", () => {
    const result = buildHistorialVentasWhere(sp({}));
    expect(result.whereSql).toBe("TRUE");
    expect(result.values).toEqual([]);
  });

  it("filters by periodo", () => {
    const result = buildHistorialVentasWhere(sp({ periodo: "month" }));
    expect(result.whereSql).toBe(
      "v.fecha_venta >= NOW() - INTERVAL '30 days'"
    );
    expect(result.values).toEqual([]);
  });

  it("filters by min_total", () => {
    const result = buildHistorialVentasWhere(sp({ min_total: "100" }));
    expect(result.whereSql).toContain("v.total >= $1");
    expect(result.values).toEqual([100]);
  });

  it("filters by max_total", () => {
    const result = buildHistorialVentasWhere(sp({ max_total: "500" }));
    expect(result.whereSql).toContain("v.total <= $1");
    expect(result.values).toEqual([500]);
  });

  it("filters by both min_total and max_total", () => {
    const result = buildHistorialVentasWhere(
      sp({ min_total: "100", max_total: "500" })
    );
    expect(result.whereSql).toContain("v.total >= $1");
    expect(result.whereSql).toContain("v.total <= $2");
    expect(result.values).toEqual([100, 500]);
  });

  it("filters by id_producto", () => {
    const result = buildHistorialVentasWhere(sp({ id_producto: "7" }));
    expect(result.whereSql).toContain("dv_f.id_producto = $1");
    expect(result.values).toEqual([7]);
  });

  it("filters by id_cliente", () => {
    const result = buildHistorialVentasWhere(sp({ id_cliente: "42" }));
    expect(result.whereSql).toContain("v.id_cliente = $1");
    expect(result.values).toEqual([42]);
  });

  it("filters by id_proveedor", () => {
    const result = buildHistorialVentasWhere(sp({ id_proveedor: "15" }));
    expect(result.whereSql).toContain("pp.id_proveedor = $1");
    expect(result.values).toEqual([15]);
  });

  it("filters by search query q", () => {
    const result = buildHistorialVentasWhere(sp({ q: "juan" }));
    expect(result.whereSql).toContain("uc.nombre ILIKE $1");
    expect(result.values).toEqual(["%juan%"]);
  });

  it("ignores empty search query", () => {
    const result = buildHistorialVentasWhere(sp({ q: "" }));
    expect(result.whereSql).toBe("TRUE");
    expect(result.values).toEqual([]);
  });

  it("ignores whitespace-only search query", () => {
    const result = buildHistorialVentasWhere(sp({ q: "   " }));
    expect(result.whereSql).toBe("TRUE");
    expect(result.values).toEqual([]);
  });

  it("combines multiple filters with AND", () => {
    const result = buildHistorialVentasWhere(
      sp({
        periodo: "month",
        min_total: "100",
        id_cliente: "42",
      })
    );
    expect(result.whereSql).toContain("AND");
    expect(result.whereSql).toContain("v.fecha_venta");
    expect(result.whereSql).toContain("v.total >= $1");
    expect(result.whereSql).toContain("v.id_cliente = $2");
    expect(result.values).toEqual([100, 42]);
  });

  it("applies omitAmountRange option", () => {
    const result = buildHistorialVentasWhere(
      sp({ min_total: "100", max_total: "500" }),
      { omitAmountRange: true }
    );
    expect(result.whereSql).toBe("TRUE");
    expect(result.values).toEqual([]);
  });

  it("still applies periodo filter with omitAmountRange", () => {
    const result = buildHistorialVentasWhere(
      sp({ periodo: "week", min_total: "100" }),
      { omitAmountRange: true }
    );
    expect(result.whereSql).toBe(
      "v.fecha_venta >= NOW() - INTERVAL '7 days'"
    );
    expect(result.values).toEqual([]);
  });

  it("ignores invalid min_total and max_total (NaN)", () => {
    const result = buildHistorialVentasWhere(
      sp({ min_total: "abc", max_total: "def" })
    );
    expect(result.whereSql).toBe("TRUE");
  });

  it("ignores negative id filters", () => {
    const result = buildHistorialVentasWhere(
      sp({ id_producto: "-1", id_cliente: "0" })
    );
    expect(result.whereSql).toBe("TRUE");
  });

  it("uses parameterized value numbering correctly", () => {
    const result = buildHistorialVentasWhere(
      sp({
        min_total: "10",
        max_total: "100",
        id_producto: "5",
        id_cliente: "3",
      })
    );
    expect(result.whereSql).toContain("v.total >= $1");
    expect(result.whereSql).toContain("v.total <= $2");
    expect(result.whereSql).toContain("dv_f.id_producto = $3");
    expect(result.whereSql).toContain("v.id_cliente = $4");
    expect(result.values).toEqual([10, 100, 5, 3]);
  });
});
