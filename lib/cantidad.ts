/**
 * Cantidades capturadas en ventas, órdenes, deudas e inventario: solo
 * enteros positivos y medios (1, 2, 1.5, 2.5…). Rechaza negativos y
 * decimales distintos de .5 para que nunca queden valores como 0.001,
 * 1.25 o -3 colgando en el formulario.
 *
 * Los inputs que la usan son type="text" + inputMode="decimal": con
 * type="number" el navegador borra el estado intermedio ("1." no es un
 * número válido) y no deja escribir un medio, y su botón de aumento usa
 * `min` como base del paso, que era justo de donde salía el 0.001.
 */
export function sanitizeCantidad(raw: string): string {
  // La coma se acepta como separador decimal: algunos teclados móviles la
  // envían en vez del punto, y sin esto "1,5" se volvería 15 en silencio.
  const [entero, ...decimales] = raw.replace(",", ".").split(".");
  const digitos = entero.replace(/\D/g, "");
  if (decimales.length === 0) return digitos;
  // Sin parte entera no hay cantidad: ".5" y ".." quedan vacíos.
  if (digitos === "") return "";
  const decimal = decimales.join("").replace(/\D/g, "");
  // "1." se conserva para no interrumpir mientras se teclea el medio.
  if (decimal === "") return `${digitos}.`;
  return decimal.startsWith("5") ? `${digitos}.5` : digitos;
}

/**
 * Sube o baja la cantidad en medios para los botones − / + de
 * components/CantidadInput. Un campo vacío arranca en 1 (no en 0.5) y nunca
 * baja de medio, así que siempre queda una cantidad positiva capturable.
 */
export function stepCantidad(actual: string, delta: number): string {
  const n = Number(actual);
  if (!Number.isFinite(n) || n <= 0) return "1";
  return String(Math.max(0.5, Math.round((n + delta / 2) * 2) / 2));
}
