// lib/credito.ts
//
// Lógica pura (sin base de datos) del crédito en ventas: plan de cuotas y
// estado de cada cuota según lo abonado. Las fechas viajan como texto
// "YYYY-MM-DD" para no depender de la zona horaria del servidor.

export const PLAZO_MAXIMO_DIAS = 365;
export const CUOTAS_MAXIMAS = 24;

export type Cuota = {
  numero: number;
  fecha_vencimiento: string; // YYYY-MM-DD
  monto: number;
};

export type EstadoCuota = "PAGADA" | "PARCIAL" | "PENDIENTE" | "VENCIDA";

export type CuotaConEstado = Cuota & {
  pagado: number;
  saldo: number;
  estado: EstadoCuota;
};

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si es una fecha real del calendario con formato YYYY-MM-DD. */
export function esFechaISO(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const m = FECHA_RE.exec(valor);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(y, mo - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === mo - 1 && f.getUTCDate() === d;
}

export function sumarDias(fechaISO: string, dias: number): string {
  const m = FECHA_RE.exec(fechaISO);
  if (!m) throw new Error(`Fecha inválida: ${fechaISO}`);
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO (b - a). */
export function diferenciaDias(aISO: string, bISO: string): number {
  const toMs = (s: string) => {
    const m = FECHA_RE.exec(s)!;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  return Math.round((toMs(bISO) - toMs(aISO)) / 86_400_000);
}

export type ErrorCredito = string;

/** Valida plazo y cuotas. Devuelve el mensaje de error, o null si está bien. */
export function validarCondicionesCredito(plazoDias: unknown, numeroCuotas: unknown): ErrorCredito | null {
  if (!Number.isInteger(plazoDias) || (plazoDias as number) < 1 || (plazoDias as number) > PLAZO_MAXIMO_DIAS) {
    return `El plazo debe ser un número entero de días entre 1 y ${PLAZO_MAXIMO_DIAS}`;
  }
  if (!Number.isInteger(numeroCuotas) || (numeroCuotas as number) < 1 || (numeroCuotas as number) > CUOTAS_MAXIMAS) {
    return `El número de pagos debe ser un entero entre 1 y ${CUOTAS_MAXIMAS}`;
  }
  if ((numeroCuotas as number) > (plazoDias as number)) {
    return "No puede haber más pagos que días de plazo";
  }
  return null;
}

/**
 * Plan de pagos: las cuotas vencen repartidas de forma pareja dentro del plazo
 * (la última siempre vence al cumplirse el plazo completo) y el total se divide
 * en centavos exactos; el sobrante de redondeo va a la última cuota.
 *
 *   generarCuotas("2026-10-11", 30, 1, 1000) -> 1 pago de Q1,000 el 2026-11-10
 *   generarCuotas("2026-10-11", 30, 2, 1000) -> Q500 el 2026-10-26 y Q500 el 2026-11-10
 */
export function generarCuotas(fechaFacturaISO: string, plazoDias: number, numeroCuotas: number, total: number): Cuota[] {
  const error = validarCondicionesCredito(plazoDias, numeroCuotas);
  if (error) throw new Error(error);
  if (!esFechaISO(fechaFacturaISO)) throw new Error(`Fecha inválida: ${fechaFacturaISO}`);

  const totalCentavos = Math.round(total * 100);
  if (!(totalCentavos > 0)) throw new Error("El total del crédito debe ser mayor a 0");
  const base = Math.floor(totalCentavos / numeroCuotas);

  const cuotas: Cuota[] = [];
  for (let i = 1; i <= numeroCuotas; i++) {
    const centavos = i === numeroCuotas ? totalCentavos - base * (numeroCuotas - 1) : base;
    cuotas.push({
      numero: i,
      fecha_vencimiento: sumarDias(fechaFacturaISO, Math.round((plazoDias * i) / numeroCuotas)),
      monto: centavos / 100,
    });
  }
  return cuotas;
}

/**
 * Aplica lo abonado, en orden, a las cuotas y calcula el estado de cada una.
 * `hoyISO` se recibe como parámetro para poder probarlo.
 */
export function asignarPagosACuotas(
  cuotas: Array<{ numero: number; fecha_vencimiento: string; monto: number | string }>,
  totalPagado: number | string,
  hoyISO: string
): CuotaConEstado[] {
  let restante = Math.round(Number(totalPagado) * 100);
  return [...cuotas]
    .sort((a, b) => a.numero - b.numero)
    .map((c) => {
      const montoCent = Math.round(Number(c.monto) * 100);
      const aplicado = Math.max(0, Math.min(montoCent, restante));
      restante -= aplicado;
      const saldoCent = montoCent - aplicado;
      const vencida = c.fecha_vencimiento < hoyISO;
      const estado: EstadoCuota =
        saldoCent <= 0 ? "PAGADA" : vencida ? "VENCIDA" : aplicado > 0 ? "PARCIAL" : "PENDIENTE";
      return {
        numero: c.numero,
        fecha_vencimiento: c.fecha_vencimiento,
        monto: montoCent / 100,
        pagado: aplicado / 100,
        saldo: saldoCent / 100,
        estado,
      };
    });
}
