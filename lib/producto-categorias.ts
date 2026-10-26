/** Una categoría principal y hasta dos adicionales, todas distintas. */
export function validarCategoriasProducto(ids: (number | null)[]): string | null {
  if (!Number.isSafeInteger(ids[0]) || (ids[0] ?? 0) < 1) return "Selecciona una categoría principal válida.";
  if (ids.some((id) => id !== null && (!Number.isSafeInteger(id) || id < 1))) return "Las categorías adicionales deben ser válidas o quedar sin categoría.";
  const seleccionadas = ids.filter((id) => id !== null);
  if (new Set(seleccionadas).size !== seleccionadas.length) return "Las categorías del producto no se pueden repetir.";
  return null;
}
