/**
 * Utilidades de formato centralizadas (dinero, números y fechas).
 *
 * Son funciones puras, sin dependencias de React ni del servidor, así que se
 * pueden importar tanto desde componentes cliente como desde rutas de la API,
 * `lib/mailer.ts`, etc.
 *
 * Convenciones:
 *  - Locale único: es-GT (ver `LOCALE`).
 *  - Moneda: quetzales, prefijo "Q" sin espacio (ej. "Q1,234.50").
 *  - Los valores `null`, `undefined`, vacíos o no numéricos NO rompen la UI:
 *    los números caen a 0 y las fechas inválidas devuelven `EMPTY_VALUE`.
 */

export const LOCALE = "es-GT";
export const CURRENCY_SYMBOL = "Q";
export const EMPTY_VALUE = "—";

type NumericInput = number | string | null | undefined;
type DateInput = Date | string | number | null | undefined;

// ─── Números ─────────────────────────────────────────────────────────────────

/** Convierte cualquier entrada a un número finito (si no se puede → 0). */
function toNumber(value: NumericInput): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Número con separador de miles y hasta `maxDecimals` decimales.
 * Reemplaza a `n.toLocaleString("es-GT", ...)`.
 *
 *   formatNumber(1234.5)                      → "1,234.5"
 *   formatNumber(1234.5678, { maxDecimals: 2 }) → "1,234.57"
 */
export function formatNumber(
  value: NumericInput,
  opts: { minDecimals?: number; maxDecimals?: number } = {}
): string {
  const { minDecimals, maxDecimals } = opts;
  return toNumber(value).toLocaleString(LOCALE, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Cantidad con un número FIJO de decimales (por defecto 3, como el stock).
 * Reemplaza a `Number(x).toFixed(3)`.
 *
 *   formatQuantity(12)     → "12.000"
 *   formatQuantity(12, 0)  → "12"
 */
export function formatQuantity(value: NumericInput, decimals = 3): string {
  return formatNumber(value, { minDecimals: decimals, maxDecimals: decimals });
}

// ─── Dinero ──────────────────────────────────────────────────────────────────

/**
 * Monto en quetzales con 2 decimales y separador de miles.
 * Reemplaza a `Q${x.toFixed(2)}` y a `Q${x.toLocaleString("es-GT", ...)}`.
 *
 *   formatMoney(75)        → "Q75.00"
 *   formatMoney("1234.5")  → "Q1,234.50"
 *   formatMoney(null)      → "Q0.00"
 */
export function formatMoney(value: NumericInput): string {
  return `${CURRENCY_SYMBOL}${formatQuantity(value, 2)}`;
}

/**
 * Redondea un monto a 2 decimales y devuelve un `number` (no un string).
 * Reemplaza a `Number(x.toFixed(2))` en cálculos de la API.
 */
export function roundMoney(value: NumericInput): number {
  return Number(toNumber(value).toFixed(2));
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Convierte a `Date`; devuelve `null` si la entrada es vacía o inválida. */
function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Solo fecha: "5/3/2026".
 * Reemplaza a `new Date(x).toLocaleDateString("es-GT")`.
 */
export function formatDate(value: DateInput, fallback = EMPTY_VALUE): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(LOCALE) : fallback;
}

/**
 * Fecha y hora cortas: "5/03/26, 3:07 p. m.".
 * Reemplaza a `toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })`
 * y a `toLocaleString("es-GT")`.
 */
export function formatDateTime(value: DateInput, fallback = EMPTY_VALUE): string {
  const d = toDate(value);
  return d ? d.toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" }) : fallback;
}

/**
 * Solo hora: "03:07 p. m.".
 * Reemplaza a `toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })`.
 */
export function formatTime(value: DateInput, fallback = EMPTY_VALUE): string {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : fallback;
}

/**
 * Fecha larga con día de la semana: "jueves, 5 de marzo".
 * Sin argumento usa la fecha de hoy (saludo del dashboard).
 */
export function formatDateLong(value: DateInput = new Date(), fallback = EMPTY_VALUE): string {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })
    : fallback;
}

/**
 * "dd/mm" a partir de una fecha ISO "YYYY-MM-DD" (etiquetas de gráficas).
 * Opera sobre el string para no depender de la zona horaria.
 */
export function formatDayMonth(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

/**
 * Fecha ISO "YYYY-MM-DD" (valor para `<input type="date">`).
 * OJO: usa UTC (comportamiento previo de `toISOString().slice(0, 10)`), por lo
 * que en Guatemala (UTC-6) después de las 18:00 devuelve el día siguiente.
 */
export function toISODate(value: DateInput = new Date()): string {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : "";
}
