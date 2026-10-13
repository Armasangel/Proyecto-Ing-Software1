export function q(n: number) {
  return `Q${n.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function pct(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export function fmtDate(iso: string) {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

/** "MINORISTA" -> "Minorista" */
export function cap(t: string) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
}

export type Granularidad = "dia" | "semana" | "mes";
export type PuntoIngresos = { clave: string; etiqueta: string; titulo: string; total: number; cantidad: number };

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIA_MS = 86_400_000;

const aUtc = (fecha: string) => new Date(`${fecha.slice(0, 10)}T00:00:00Z`);

/**
 * Ordena y agrupa las ventas diarias para que la gráfica siempre se lea bien:
 * hasta 31 días de rango → por día; hasta 120 → por semana; más → por mes.
 */
export function agruparIngresos(
  data: { fecha: string; total_dia: number; cantidad: number }[]
): { puntos: PuntoIngresos[]; granularidad: Granularidad } {
  if (data.length === 0) return { puntos: [], granularidad: "dia" };

  const ordenado = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const rangoDias = Math.round((aUtc(ordenado[ordenado.length - 1].fecha).getTime() - aUtc(ordenado[0].fecha).getTime()) / DIA_MS) + 1;
  const granularidad: Granularidad = rangoDias <= 31 ? "dia" : rangoDias <= 120 ? "semana" : "mes";

  const grupos = new Map<string, PuntoIngresos>();
  for (const d of ordenado) {
    const f = d.fecha.slice(0, 10);
    let clave = f;
    let etiqueta = fmtDate(f);
    let titulo = `${fmtDate(f)}/${f.slice(0, 4)}`;

    if (granularidad === "semana") {
      const fecha = aUtc(f);
      const lunes = new Date(fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * DIA_MS).toISOString().slice(0, 10);
      clave = lunes;
      etiqueta = fmtDate(lunes);
      titulo = `Semana del ${fmtDate(lunes)}`;
    } else if (granularidad === "mes") {
      const mes = Number(f.slice(5, 7)) - 1;
      clave = f.slice(0, 7);
      etiqueta = MESES_CORTO[mes];
      titulo = `${MESES_LARGO[mes]} ${f.slice(0, 4)}`;
    }

    const previo = grupos.get(clave);
    if (previo) {
      previo.total += d.total_dia;
      previo.cantidad += d.cantidad;
    } else {
      grupos.set(clave, { clave, etiqueta, titulo, total: d.total_dia, cantidad: d.cantidad });
    }
  }
  return { puntos: [...grupos.values()], granularidad };
}

