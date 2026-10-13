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
 * Plan de pagos "vivo": parte del plan original y le aplica los pagos hechos,
 * en orden. Reglas:
 *   - Cada pago cubre la cuota que toca. Si es igual o mayor al monto de esa
 *     cuota, la cuota queda pagada y lo que sobró (o la diferencia) se
 *     descuenta del saldo: las cuotas que faltan se vuelven a calcular
 *     repartiendo el saldo restante de forma pareja.
 *   - Pagar de más adelanta el plan: si el saldo restante es 0, las cuotas que
 *     faltaban quedan cubiertas.
 *   - Un pago menor a la cuota (solo posible en datos anteriores a esta regla)
 *     queda como pago parcial de esa cuota, sin recalcular las demás.
 * `hoyISO` se recibe como parámetro para poder probarlo.
 */
export function planConPagos(
  cuotas: Array<{ numero: number; fecha_vencimiento: string; monto: number | string }>,
  pagos: Array<number | string>,
  hoyISO: string
): CuotaConEstado[] {
  const plan = [...cuotas].sort((a, b) => a.numero - b.numero);
  const dinamico = plan.map((c) => Math.round(Number(c.monto) * 100)); // monto vigente de cada cuota
  const pagado = plan.map(() => 0);
  const total = dinamico.reduce((acc, m) => acc + m, 0);
  let acumulado = 0;

  for (const pago of pagos) {
    const centavos = Math.round(Number(pago) * 100);
    if (!(centavos > 0)) continue;
    const i = plan.findIndex((_, k) => pagado[k] < dinamico[k]);
    if (i === -1) break; // ya no hay cuotas por cubrir
    const falta = dinamico[i] - pagado[i];
    pagado[i] += centavos;
    acumulado += centavos;

    if (centavos >= falta) {
      // Cuota cubierta: lo que falta pagar se reparte entre las cuotas siguientes.
      const restante = Math.max(0, total - acumulado);
      const siguientes = plan.map((_, k) => k).filter((k) => k > i);
      if (siguientes.length > 0) {
        const base = Math.floor(restante / siguientes.length);
        siguientes.forEach((k, j) => {
          dinamico[k] = j === siguientes.length - 1 ? restante - base * (siguientes.length - 1) : base;
        });
      }
    }
  }

  return plan.map((c, k) => {
    const saldo = Math.max(0, dinamico[k] - pagado[k]);
    const vencida = c.fecha_vencimiento < hoyISO;
    const estado: EstadoCuota = saldo === 0 ? "PAGADA" : vencida ? "VENCIDA" : pagado[k] > 0 ? "PARCIAL" : "PENDIENTE";
    return {
      numero: c.numero,
      fecha_vencimiento: c.fecha_vencimiento,
      monto: dinamico[k] / 100,
      pagado: pagado[k] / 100,
      saldo: saldo / 100,
      estado,
    };
  });
}

export type ReglaPago = {
  /** Menor monto aceptado en este momento. */
  minimo: number;
  /** Mayor monto aceptado (todo el saldo restante). */
  maximo: number;
  /** Cuota que se está pagando (null si ya no queda ninguna). */
  cuota: CuotaConEstado | null;
  totalCuotas: number;
  /** true si la cuenta es de pago único: solo se acepta el saldo completo. */
  pagoUnico: boolean;
};

/**
 * Qué monto se puede abonar ahora a una cuenta con plan de pagos:
 *   - pago único: solo el saldo completo;
 *   - varios pagos: como mínimo lo que falta de la cuota actual (se puede pagar
 *     más, hasta el saldo total).
 */
export function reglaDePago(plan: CuotaConEstado[]): ReglaPago {
  const cuota = plan.find((c) => c.saldo > 0) ?? null;
  const maximoCent = plan.reduce((acc, c) => acc + Math.round(c.saldo * 100), 0);
  const pagoUnico = plan.length === 1;
  const minimoCent = !cuota ? 0 : pagoUnico ? maximoCent : Math.round(cuota.saldo * 100);
  return {
    minimo: minimoCent / 100,
    maximo: maximoCent / 100,
    cuota,
    totalCuotas: plan.length,
    pagoUnico,
  };
}
