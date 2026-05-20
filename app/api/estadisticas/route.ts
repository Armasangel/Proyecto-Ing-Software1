// app/api/estadisticas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PeriodoKey = "day" | "week" | "month" | "quarter" | "year" | "custom";

const PERIODO_SQL: Record<Exclude<PeriodoKey, "custom">, string> = {
  day:     "NOW() - INTERVAL '1 day'",
  week:    "NOW() - INTERVAL '7 days'",
  month:   "NOW() - INTERVAL '30 days'",
  quarter: "NOW() - INTERVAL '90 days'",
  year:    "NOW() - INTERVAL '365 days'",
};

// ─── Helpers estadísticos ────────────────────────────────────────────────────

/** Mediana de un array de números ya ordenado (o lo ordena internamente). */
function calcMediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Moda: valor(es) más frecuente(s). Redondea a 2 decimales para agrupar. */
function calcModa(valores: number[]): number[] {
  if (valores.length === 0) return [];
  const freq = new Map<number, number>();
  for (const v of valores) {
    const key = Math.round(v * 100) / 100;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const maxFreq = Math.max(...freq.values());
  // Solo devuelve moda si hay repetición real
  if (maxFreq === 1) return [];
  return [...freq.entries()]
    .filter(([, f]) => f === maxFreq)
    .map(([k]) => k)
    .sort((a, b) => a - b);
}

/** Desviación estándar poblacional. */
function calcDesviacionEstandar(valores: number[], media: number): number {
  if (valores.length < 2) return 0;
  const varianza =
    valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
  return Math.sqrt(varianza);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth — solo dueño
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  // 2. Parámetros
  const sp = req.nextUrl.searchParams;
  const periodo = (sp.get("periodo") ?? "month") as PeriodoKey;
  const desde = sp.get("desde") ?? "";    // ISO date, solo para custom
  const hasta = sp.get("hasta") ?? "";    // ISO date, solo para custom

  // 3. Construir filtro de fecha
  let fechaFiltro: string;
  const fechaParams: string[] = [];

  if (periodo === "custom") {
    if (!desde || !hasta) {
      return validationError(
        'Para periodo "custom" se requieren los parámetros "desde" y "hasta" (YYYY-MM-DD).'
      );
    }
    // Validar formato básico
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return validationError('Los parámetros "desde" y "hasta" deben tener formato YYYY-MM-DD.');
    }
    if (desde > hasta) {
      return validationError('"desde" no puede ser posterior a "hasta".');
    }
    // Usamos $1 y $2 como parámetros parametrizados en las queries
    fechaFiltro = `v.fecha_venta BETWEEN $1::date AND ($2::date + INTERVAL '1 day')`;
    fechaParams.push(desde, hasta);
  } else if (PERIODO_SQL[periodo]) {
    fechaFiltro = `v.fecha_venta >= ${PERIODO_SQL[periodo]}`;
  } else {
    return validationError(
      'Periodo inválido. Use: day, week, month, quarter, year o custom.'
    );
  }

  // helper para armar offset de params en queries que usan fecha custom
  const p = (n: number) => (periodo === "custom" ? `$${n + 2}` : `$${n}`);
  // Para queries sin parámetros extra, fechaParams ya contiene los valores base

  try {
    // ── 4. Resumen general ────────────────────────────────────────────────────
    const resumenQ = await pool.query<{
      total_ventas: string;
      ingresos_totales: string;
      ticket_promedio: string;
      ventas_canceladas: string;
    }>(
      `SELECT
         COUNT(*)::int                                    AS total_ventas,
         COALESCE(SUM(v.total), 0)::numeric              AS ingresos_totales,
         COALESCE(AVG(v.total), 0)::numeric              AS ticket_promedio,
         COUNT(*) FILTER (WHERE v.estado_venta = 'CANCELADO')::int AS ventas_canceladas
       FROM venta v
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'`,
      fechaParams
    );

    // ── 5. Totales individuales para estadísticas descriptivas ────────────────
    const totalesQ = await pool.query<{ total: string }>(
      `SELECT v.total
       FROM venta v
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       ORDER BY v.total`,
      fechaParams
    );
    const totalesArr = totalesQ.rows.map((r) => Number(r.total));

    const media = totalesArr.length > 0
      ? totalesArr.reduce((a, b) => a + b, 0) / totalesArr.length
      : 0;
    const mediana = calcMediana(totalesArr);
    const moda = calcModa(totalesArr);
    const desviacionEstandar = calcDesviacionEstandar(totalesArr, media);
    const minTotal = totalesArr.length > 0 ? Math.min(...totalesArr) : 0;
    const maxTotal = totalesArr.length > 0 ? Math.max(...totalesArr) : 0;

    // ── 6. Ventas agrupadas por día (para gráfica de línea/barras) ────────────
    const ventasPorDiaQ = await pool.query<{ fecha: string; total_dia: string; cantidad: string }>(
      `SELECT
         DATE(v.fecha_venta)::text                  AS fecha,
         COALESCE(SUM(v.total), 0)::numeric         AS total_dia,
         COUNT(*)::int                               AS cantidad
       FROM venta v
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY DATE(v.fecha_venta)
       ORDER BY DATE(v.fecha_venta)`,
      fechaParams
    );

    // ── 7. Ventas por tipo (MINORISTA / MAYORISTA) ────────────────────────────
    const ventasPorTipoQ = await pool.query<{
      tipo_venta: string;
      cantidad: string;
      ingresos: string;
    }>(
      `SELECT
         v.tipo_venta,
         COUNT(*)::int              AS cantidad,
         COALESCE(SUM(v.total), 0)::numeric AS ingresos
       FROM venta v
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY v.tipo_venta`,
      fechaParams
    );

    // ── 8. Ventas por estado ──────────────────────────────────────────────────
    const ventasPorEstadoQ = await pool.query<{
      estado_venta: string;
      cantidad: string;
    }>(
      `SELECT
         v.estado_venta,
         COUNT(*)::int AS cantidad
       FROM venta v
       WHERE ${fechaFiltro}
       GROUP BY v.estado_venta
       ORDER BY cantidad DESC`,
      fechaParams
    );

    // ── 9. Top 10 productos más comprados ────────────────────────────────────
    //    Unidades vendidas (no canceladas) + venta en quetzales
    const topProductosQ = await pool.query<{
      id_producto: string;
      codigo_producto: string;
      nombre_producto: string;
      unidad_medida: string;
      nombre_categoria: string;
      nombre_marca: string;
      total_unidades: string;
      total_ingresos: string;
      veces_vendido: string;
    }>(
      `SELECT
         p.id_producto::text,
         p.codigo_producto,
         p.nombre_producto,
         p.unidad_medida,
         c.nombre_categoria,
         m.nombre_marca,
         SUM(dv.cantidad)::numeric        AS total_unidades,
         SUM(dv.subtotal)::numeric        AS total_ingresos,
         COUNT(DISTINCT dv.id_venta)::int AS veces_vendido
       FROM detalle_venta dv
       JOIN venta v   ON v.id_venta    = dv.id_venta
       JOIN producto p ON p.id_producto = dv.id_producto
       JOIN categoria c ON c.id_categoria = p.id_categoria
       JOIN marca m    ON m.id_marca    = p.id_marca
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY p.id_producto, p.codigo_producto, p.nombre_producto,
                p.unidad_medida, c.nombre_categoria, m.nombre_marca
       ORDER BY total_unidades DESC
       LIMIT 10`,
      fechaParams
    );

    // ── 10. Producto más comprado (posición 0 del top) ─────────────────────
    const productoMasComprado = topProductosQ.rows[0] ?? null;

    // ── 11. Top 5 clientes por ingresos ──────────────────────────────────────
    const topClientesQ = await pool.query<{
      id_usuario: string;
      nombre: string;
      correo: string;
      tipo_usuario: string;
      total_compras: string;
      cantidad_pedidos: string;
    }>(
      `SELECT
         u.id_usuario::text,
         u.nombre,
         u.correo,
         u.tipo_usuario,
         SUM(v.total)::numeric         AS total_compras,
         COUNT(v.id_venta)::int        AS cantidad_pedidos
       FROM venta v
       JOIN usuario u ON u.id_usuario = v.id_usuario
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY u.id_usuario, u.nombre, u.correo, u.tipo_usuario
       ORDER BY total_compras DESC
       LIMIT 5`,
      fechaParams
    );

    // ── 12. Ingresos por categoría ────────────────────────────────────────────
    const ingresosPorCategoriaQ = await pool.query<{
      nombre_categoria: string;
      total_ingresos: string;
      total_unidades: string;
    }>(
      `SELECT
         c.nombre_categoria,
         SUM(dv.subtotal)::numeric  AS total_ingresos,
         SUM(dv.cantidad)::numeric  AS total_unidades
       FROM detalle_venta dv
       JOIN venta v    ON v.id_venta      = dv.id_venta
       JOIN producto p ON p.id_producto   = dv.id_producto
       JOIN categoria c ON c.id_categoria = p.id_categoria
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY c.nombre_categoria
       ORDER BY total_ingresos DESC`,
      fechaParams
    );

    // ── 13. Distribución de ventas por hora del día ────────────────────────
    const ventasPorHoraQ = await pool.query<{ hora: string; cantidad: string }>(
      `SELECT
         EXTRACT(HOUR FROM v.fecha_venta)::int::text AS hora,
         COUNT(*)::int                                AS cantidad
       FROM venta v
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY EXTRACT(HOUR FROM v.fecha_venta)
       ORDER BY hora`,
      fechaParams
    );

    // ── 14. Comparativa vs periodo anterior (mismo rango de días) ──────────
    //    Solo disponible para periodos fijos (no custom)
    let comparativaPeriodoAnterior: {
      total_ventas_anterior: number;
      ingresos_anteriores: number;
    } | null = null;

    if (periodo !== "custom") {
      const intervalMap: Record<Exclude<PeriodoKey, "custom">, string> = {
        day:     "1 day",
        week:    "7 days",
        month:   "30 days",
        quarter: "90 days",
        year:    "365 days",
      };
      const interval = intervalMap[periodo];
      const comparQ = await pool.query<{
        total_ventas_anterior: string;
        ingresos_anteriores: string;
      }>(
        `SELECT
           COUNT(*)::int                       AS total_ventas_anterior,
           COALESCE(SUM(v.total), 0)::numeric  AS ingresos_anteriores
         FROM venta v
         WHERE v.fecha_venta >= NOW() - INTERVAL '${interval}' * 2
           AND v.fecha_venta <  NOW() - INTERVAL '${interval}'
           AND v.estado_venta != 'CANCELADO'`
      );
      comparativaPeriodoAnterior = {
        total_ventas_anterior: Number(comparQ.rows[0]?.total_ventas_anterior ?? 0),
        ingresos_anteriores: Number(comparQ.rows[0]?.ingresos_anteriores ?? 0),
      };
    }

    // ── 15. Bodega con mayor movimiento ───────────────────────────────────────
    const bodegaTopQ = await pool.query<{
      id_bodega: string;
      nombre_bodega: string;
      total_ventas: string;
      ingresos: string;
    }>(
      `SELECT
         b.id_bodega::text,
         b.nombre_bodega,
         COUNT(DISTINCT v.id_venta)::int AS total_ventas,
         COALESCE(SUM(v.total), 0)::numeric AS ingresos
       FROM venta v
       JOIN bodega b ON b.id_bodega = v.id_bodega
       WHERE ${fechaFiltro}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY b.id_bodega, b.nombre_bodega
       ORDER BY ingresos DESC
       LIMIT 5`,
      fechaParams
    );

    // ─── Respuesta final ───────────────────────────────────────────────────────
    const resumen = resumenQ.rows[0];

    return NextResponse.json({
      periodo: {
        tipo: periodo,
        desde: desde || null,
        hasta: hasta || null,
      },

      resumen: {
        total_ventas:       Number(resumen?.total_ventas ?? 0),
        ingresos_totales:   Number(resumen?.ingresos_totales ?? 0),
        ticket_promedio:    Number(resumen?.ticket_promedio ?? 0),
        ventas_canceladas:  Number(resumen?.ventas_canceladas ?? 0),
      },

      estadisticas_descriptivas: {
        media:              Math.round(media * 100) / 100,
        mediana:            Math.round(mediana * 100) / 100,
        moda:               moda.map((v) => Math.round(v * 100) / 100),
        desviacion_estandar: Math.round(desviacionEstandar * 100) / 100,
        min_total:          Math.round(minTotal * 100) / 100,
        max_total:          Math.round(maxTotal * 100) / 100,
        n:                  totalesArr.length,
      },

      ventas_por_dia: ventasPorDiaQ.rows.map((r) => ({
        fecha:     r.fecha,
        total_dia: Number(r.total_dia),
        cantidad:  Number(r.cantidad),
      })),

      ventas_por_tipo: ventasPorTipoQ.rows.map((r) => ({
        tipo_venta: r.tipo_venta,
        cantidad:   Number(r.cantidad),
        ingresos:   Number(r.ingresos),
      })),

      ventas_por_estado: ventasPorEstadoQ.rows.map((r) => ({
        estado_venta: r.estado_venta,
        cantidad:     Number(r.cantidad),
      })),

      top_productos: topProductosQ.rows.map((r) => ({
        id_producto:      Number(r.id_producto),
        codigo_producto:  r.codigo_producto,
        nombre_producto:  r.nombre_producto,
        unidad_medida:    r.unidad_medida,
        nombre_categoria: r.nombre_categoria,
        nombre_marca:     r.nombre_marca,
        total_unidades:   Number(r.total_unidades),
        total_ingresos:   Number(r.total_ingresos),
        veces_vendido:    Number(r.veces_vendido),
      })),

      producto_mas_comprado: productoMasComprado
        ? {
            id_producto:     Number(productoMasComprado.id_producto),
            codigo_producto: productoMasComprado.codigo_producto,
            nombre_producto: productoMasComprado.nombre_producto,
            unidad_medida:   productoMasComprado.unidad_medida,
            nombre_categoria:productoMasComprado.nombre_categoria,
            nombre_marca:    productoMasComprado.nombre_marca,
            total_unidades:  Number(productoMasComprado.total_unidades),
            total_ingresos:  Number(productoMasComprado.total_ingresos),
            veces_vendido:   Number(productoMasComprado.veces_vendido),
          }
        : null,

      top_clientes: topClientesQ.rows.map((r) => ({
        id_usuario:       Number(r.id_usuario),
        nombre:           r.nombre,
        correo:           r.correo,
        tipo_usuario:     r.tipo_usuario,
        total_compras:    Number(r.total_compras),
        cantidad_pedidos: Number(r.cantidad_pedidos),
      })),

      ingresos_por_categoria: ingresosPorCategoriaQ.rows.map((r) => ({
        nombre_categoria: r.nombre_categoria,
        total_ingresos:   Number(r.total_ingresos),
        total_unidades:   Number(r.total_unidades),
      })),

      ventas_por_hora: ventasPorHoraQ.rows.map((r) => ({
        hora:     Number(r.hora),
        cantidad: Number(r.cantidad),
      })),

      comparativa_periodo_anterior: comparativaPeriodoAnterior,

      top_bodegas: bodegaTopQ.rows.map((r) => ({
        id_bodega:    Number(r.id_bodega),
        nombre_bodega: r.nombre_bodega,
        total_ventas: Number(r.total_ventas),
        ingresos:     Number(r.ingresos),
      })),
    });
  } catch (error) {
    return apiError("ESTADISTICAS GET", error);
  }
}