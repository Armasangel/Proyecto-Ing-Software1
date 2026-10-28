/** Utility helpers for pagination parameter handling.
 *
 * These are small pure functions that can be used across routes
 * when custom parsing beyond what `lib/pagination.ts` offers is needed.
 */

/** Parse a page number string, returning a clamped minimum value. */
export function parsePageParam(raw: string | null, def: number = 1): number {
  if (raw === null || raw === "") return def;
  const p = Number(raw);
  return Number.isFinite(p) && p >= 1 ? p : def;
}

/** Parse a limit number string, clamped between min and max. */
export function parseLimitParam(
  raw: string | null,
  def: number,
  max: number,
  min: number = 1
): number {
  if (raw === null || raw === "") return def;
  const l = Number(raw);
  if (!Number.isFinite(l)) return def;
  return Math.min(Math.max(l, min), max);
}

/** Parse an offset number string, clamped to be non-negative. */
export function parseOffsetParam(raw: string | null): number {
  if (raw === null || raw === "") return 0;
  const o = Number(raw);
  return Number.isFinite(o) && o >= 0 ? o : 0;
}

/** Clamp a value to a [min, max] range. */
export function clampValue(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Default constants reused by the unified lib. */
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
  MIN_LIMIT: 1,
};