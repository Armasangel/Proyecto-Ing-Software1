export type Presentacion = {
  id_presentacion?: number;
  nombre_presentacion: string;
  factor_conversion: number;
};

const ALIAS_UNIDADES: Record<string, string[]> = {
  libra: ["libra", "libras", "lb", "lbs"],
  litro: ["litro", "litros", "l", "lt", "lts"],
  mililitro: ["mililitro", "mililitros", "ml"],
  kilogramo: ["kilogramo", "kilogramos", "kilo", "kilos", "kg"],
  gramo: ["gramo", "gramos", "g", "gr"],
  unidad: ["unidad", "unidades", "und", "u"],
  botella: ["botella", "botellas"],
  galon: ["galon", "galones"],
};

export function normalizarPresentacion(texto: string): string {
  return texto.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizarUnidad(unidad: string): string {
  const texto = normalizarPresentacion(unidad);
  return Object.keys(ALIAS_UNIDADES).find((key) => ALIAS_UNIDADES[key].includes(texto)) ?? texto;
}

export function aliasesUnidad(unidad: string): string[] {
  return ALIAS_UNIDADES[normalizarUnidad(unidad)] ?? [normalizarPresentacion(unidad)];
}

const opcion = (nombre_presentacion: string, factor_conversion: number): Presentacion => ({ nombre_presentacion, factor_conversion });

/** Sugerencias expresadas exclusivamente en la unidad base indicada. */
export function sugerenciasPresentaciones(unidad: string): Presentacion[] {
  switch (normalizarUnidad(unidad)) {
    case "libra": return [opcion("Libra", 1), opcion("Media libra", 0.5), opcion("2 libras", 2), opcion("3 libras", 3), opcion("5 libras", 5), opcion("10 libras", 10), opcion("20 libras", 20), opcion("Arroba (25 libras)", 25), opcion("Saco de 50 libras", 50), opcion("Quintal (100 libras)", 100)];
    case "litro": return [opcion("Litro", 1), opcion("Medio litro", 0.5), opcion("250 mililitros", 0.25), opcion("5 litros", 5), opcion("10 litros", 10), opcion("20 litros", 20)];
    case "mililitro": return [opcion("Mililitro", 1), opcion("250 mililitros", 250), opcion("500 mililitros", 500), opcion("Litro", 1000), opcion("5 litros", 5000)];
    case "kilogramo": return [opcion("Kilogramo", 1), opcion("Medio kilogramo", 0.5), opcion("250 gramos", 0.25), opcion("5 kilogramos", 5), opcion("Saco de 25 kilogramos", 25), opcion("Saco de 50 kilogramos", 50)];
    case "gramo": return [opcion("Gramo", 1), opcion("100 gramos", 100), opcion("250 gramos", 250), opcion("500 gramos", 500), opcion("Kilogramo", 1000)];
    case "unidad": return [opcion("Unidad", 1), opcion("Media docena", 6), opcion("Docena", 12), opcion("Paquete de 6", 6), opcion("Caja de 12", 12), opcion("Caja de 24", 24)];
    case "botella": return [opcion("Botella", 1), opcion("Paquete de 6 botellas", 6), opcion("Caja de 12 botellas", 12), opcion("Caja de 24 botellas", 24), opcion("Caja de 48 botellas", 48)];
    case "galon": return [opcion("Galón", 1), opcion("Medio galón", 0.5), opcion("2 galones", 2), opcion("5 galones", 5), opcion("10 galones", 10)];
    default: return unidad.trim() ? [opcion(unidad.trim(), 1)] : [];
  }
}

/** Completa el catálogo sin suponer el tamaño de cajas o botellas. */
export function presentacionesIniciales(unidad: string): Presentacion[] {
  return sugerenciasPresentaciones(unidad).filter((p) => p.factor_conversion === 1 ||
    (normalizarUnidad(unidad) === "libra" && [25, 50, 100].includes(p.factor_conversion)));
}

export function validarPresentaciones(valor: unknown): string | null {
  if (!Array.isArray(valor) || valor.length === 0) return "Selecciona al menos una presentación.";
  const nombres = new Set<string>();
  for (const p of valor) {
    if (!p || typeof p.nombre_presentacion !== "string" || !p.nombre_presentacion.trim() || p.nombre_presentacion.trim().length > 100) {
      return "Cada presentación debe tener un nombre de hasta 100 caracteres.";
    }
    if (typeof p.factor_conversion !== "number" || !Number.isFinite(p.factor_conversion) || p.factor_conversion < 0.001 || p.factor_conversion > 999999999.999 || Math.abs(p.factor_conversion * 1000 - Math.round(p.factor_conversion * 1000)) > 0.0001) {
      return "La equivalencia debe ser positiva y tener como máximo 3 decimales.";
    }
    if (p.id_presentacion !== undefined && (!Number.isSafeInteger(p.id_presentacion) || p.id_presentacion < 1)) return "Presentación inválida.";
    const nombre = normalizarPresentacion(p.nombre_presentacion);
    if (nombres.has(nombre)) return "No se puede repetir el nombre de una presentación.";
    nombres.add(nombre);
  }
  return null;
}
