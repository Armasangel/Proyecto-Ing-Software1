import { agruparIngresos } from "@/components/reportes/utils";

const dia = (fecha: string, total_dia = 100, cantidad = 1) => ({ fecha, total_dia, cantidad });

/** n días seguidos desde una fecha, con una venta de Q10 cada día */
function racha(desde: string, n: number) {
  const inicio = new Date(`${desde}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => dia(new Date(inicio + i * 86_400_000).toISOString().slice(0, 10), 10, 1));
}

describe("agruparIngresos", () => {
  it("devuelve vacío si no hay datos", () => {
    expect(agruparIngresos([])).toEqual({ puntos: [], granularidad: "dia" });
  });

  it("un solo día: un punto por día", () => {
    const { puntos, granularidad } = agruparIngresos([dia("2026-09-14", 300, 3)]);
    expect(granularidad).toBe("dia");
    expect(puntos).toHaveLength(1);
    expect(puntos[0]).toMatchObject({ etiqueta: "14/09", total: 300, cantidad: 3 });
  });

  it("hasta 31 días de rango se queda por día y ordena las fechas", () => {
    const { puntos, granularidad } = agruparIngresos([dia("2026-09-20"), dia("2026-09-05"), dia("2026-09-12")]);
    expect(granularidad).toBe("dia");
    expect(puntos.map((p) => p.clave)).toEqual(["2026-09-05", "2026-09-12", "2026-09-20"]);
  });

  it("entre 32 y 120 días agrupa por semana (lunes) y suma totales", () => {
    // 2026-09-14 es lunes; 14 al 20 es una semana, 21 es la siguiente
    const datos = [...racha("2026-07-01", 40), dia("2026-09-14", 10), dia("2026-09-16", 20), dia("2026-09-21", 5)];
    const { puntos, granularidad } = agruparIngresos(datos);
    expect(granularidad).toBe("semana");
    const sem = puntos.find((p) => p.clave === "2026-09-14");
    expect(sem).toMatchObject({ total: 30, cantidad: 2, titulo: "Semana del 14/09" });
    expect(puntos.find((p) => p.clave === "2026-09-21")).toMatchObject({ total: 5 });
    expect(puntos.length).toBeLessThanOrEqual(20);
  });

  it("más de 120 días agrupa por mes, como máximo 12 barras en un año", () => {
    const { puntos, granularidad } = agruparIngresos(racha("2025-10-06", 365));
    expect(granularidad).toBe("mes");
    expect(puntos.length).toBeLessThanOrEqual(13);
    expect(puntos[0].etiqueta).toBe("oct");
    const total = puntos.reduce((sum, p) => sum + p.total, 0);
    expect(total).toBe(3650);
  });

  it("no modifica el arreglo original", () => {
    const original = [dia("2026-09-20"), dia("2026-09-05")];
    agruparIngresos(original);
    expect(original[0].fecha).toBe("2026-09-20");
  });
});
