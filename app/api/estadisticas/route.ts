// app/api/estadisticas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PeriodoKey = "day" | "week" | "month" | "quarter" | "year" | "custom";

// ─── Helpers estadísticos (JS) ────────────────────────────────────────────────

function calcMediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calcModa(valores: number[]): number[] {
  if (valores.length === 0) return [];
  const freq = new Map<number, number>();
  for (const v of valores) {
    const key = Math.round(v * 100) / 100;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const maxFreq = Math.max(...freq.values());
  if (maxFreq === 1) return [];
  return [...freq.entries()]
    .filter(([, f]) => f === maxFreq)
    .map(([k]) => k)
    .sort((a, b) => a - b);
}

function calcDesviacionEstandar(valores: number[], media: number): number {
  if (valores.length < 2) return 0;
  const varianza =
    valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
  return Math.sqrt(varianza);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth — solo dueño
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  // 2. Parámetros
  const sp = req.nextUrl.searchParams;
  const periodo = (sp.get("periodo") ?? "month") as PeriodoKey;
  const desde = sp.get("desde") ?? "";
  const hasta = sp.get("hasta") ?? "";

  // 3. Construir cláusula WHERE de fecha
  //    Para "custom" usamos parámetros ($1, $2).
  //    Para periodos fijos interpolamos el intervalo (seguro: valor fijo de nuestro Map).
  const INTERVALOS: Record<Exclude<PeriodoKey, "custom">, string> = {
    day:     "1 day",
    week:    "7 days",
    month:   "30 days",
    quarter: "90 days",
    year:    "365 days",
  };

  let fechaWhere: string;
  let fechaParams: unknown[];

  if (periodo === "custom") {
    if (!desde || !hasta) {
      return validationError('Para periodo "custom" se requieren "desde" y "hasta" (YYYY-MM-DD).');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return validationError('Los parámetros "desde" y "hasta" deben tener formato YYYY-MM-DD.');
    }
    if (desde > hasta) {
      return validationError('"desde" no puede ser posterior a "hasta".');
    }
    // $1 = desde, $2 = hasta  →  los pasamos como params a TODAS las queries
    fechaWhere = `v.fecha_venta >= $1::date AND v.fecha_venta < ($2::date + INTERVAL '1 day')`;
    fechaParams = [desde, hasta];
  } else {
    if (!INTERVALOS[periodo]) {
      return validationError("Periodo inválido. Use: day, week, month, quarter, year o custom.");
    }
    // Interpolación segura: el valor viene de nuestro Map, no del usuario
    fechaWhere = `v.fecha_venta >= NOW() - INTERVAL '${INTERVALOS[periodo]}'`;
    fechaParams = [];
  }

  // helper: siguiente índice de param ($1 si no hay fechaParams, $3 si hay 2, etc.)
  const nextParam = (offset = 0) =>
    fechaParams.length + offset + 1;

  try {
    // ── 4. Resumen general ────────────────────────────────────────────────────
    const resumenQ = await pool.query<{
      total_ventas: string;
      ingresos_totales: string;
      ticket_promedio: string;
      ventas_canceladas: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE v.estado_venta != 'CANCELADO')::int  AS total_ventas,
         COALESCE(SUM(v.total) FILTER (WHERE v.estado_venta != 'CANCELADO'), 0)::numeric AS ingresos_totales,
         COALESCE(AVG(v.total) FILTER (WHERE v.estado_venta != 'CANCELADO'), 0)::numeric AS ticket_promedio,
         COUNT(*) FILTER (WHERE v.estado_venta = 'CANCELADO')::int   AS ventas_canceladas
       FROM venta v
       WHERE ${fechaWhere}`,
      fechaParams
    );

    // ── 5. Totales individuales para estadísticas descriptivas ────────────────
    const totalesQ = await pool.query<{ total: string }>(
      `SELECT v.total
       FROM venta v
       WHERE ${fechaWhere}
         AND v.estado_venta != 'CANCELADO'
       ORDER BY v.total`,
      fechaParams
    );
    const totalesArr = totalesQ.rows.map((r) => Number(r.total));

    const media = totalesArr.length > 0
      ? totalesArr.reduce((a, b) => a + b, 0) / totalesArr.length
      : 0;
    const mediana             = calcMediana(totalesArr);
    const moda                = calcModa(totalesArr);
    const desviacionEstandar  = calcDesviacionEstandar(totalesArr, media);
    const minTotal            = totalesArr.length > 0 ? Math.min(...totalesArr) : 0;
    const maxTotal            = totalesArr.length > 0 ? Math.max(...totalesArr) : 0;

    // ── 6. Ventas agrupadas por día ───────────────────────────────────────────
    const ventasPorDiaQ = await pool.query<{
      fecha: string;
      total_dia: string;
      cantidad: string;
    }>(
      `SELECT
         DATE(v.fecha_venta)::text              AS fecha,
         COALESCE(SUM(v.total), 0)::numeric     AS total_dia,
         COUNT(*)::int                           AS cantidad
       FROM venta v
       WHERE ${fechaWhere}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY DATE(v.fecha_venta)
       ORDER BY DATE(v.fecha_venta)`,
      fechaParams
    );

    // ── 7. Ventas por tipo ────────────────────────────────────────────────────
    const ventasPorTipoQ = await pool.query<{
      tipo_venta: string;
      cantidad: string;
      ingresos: string;
    }>(
      `SELECT
         v.tipo_venta,
         COUNT(*)::int                              AS cantidad,
         COALESCE(SUM(v.total), 0)::numeric         AS ingresos
       FROM venta v
       WHERE ${fechaWhere}
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
       WHERE ${fechaWhere}
       GROUP BY v.estado_venta
       ORDER BY cantidad DESC`,
      fechaParams
    );

    // ── 9. Top 10 productos más comprados ────────────────────────────────────
    //    NOTA: el WHERE de fecha va sobre la tabla venta (alias v),
    //    que se une a detalle_venta. La subcláusula de fecha NO usa alias "v"
    //    distinto — hay que asegurarse de que el alias coincida.
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
         SUM(dv.cantidad)::numeric         AS total_unidades,
         SUM(dv.subtotal)::numeric         AS total_ingresos,
         COUNT(DISTINCT dv.id_venta)::int  AS veces_vendido
       FROM detalle_venta dv
       JOIN venta     v  ON v.id_venta     = dv.id_venta
       JOIN producto  p  ON p.id_producto  = dv.id_producto
       JOIN categoria c  ON c.id_categoria = p.id_categoria
       JOIN marca     m  ON m.id_marca     = p.id_marca
       WHERE ${fechaWhere}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY p.id_producto, p.codigo_producto, p.nombre_producto,
                p.unidad_medida, c.nombre_categoria, m.nombre_marca
       ORDER BY total_unidades DESC
       LIMIT 10`,
      fechaParams
    );

    const productoMasComprado = topProductosQ.rows[0] ?? null;

    // ── 10. Top 5 clientes por ingresos ──────────────────────────────────────
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
         SUM(v.total)::numeric          AS total_compras,
         COUNT(v.id_venta)::int         AS cantidad_pedidos
       FROM venta v
       JOIN usuario u ON u.id_usuario = v.id_usuario
       WHERE ${fechaWhere}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY u.id_usuario, u.nombre, u.correo, u.tipo_usuario
       ORDER BY total_compras DESC
       LIMIT 5`,
      fechaParams
    );

    // ── 11. Ingresos por categoría ────────────────────────────────────────────
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
       JOIN venta     v  ON v.id_venta     = dv.id_venta
       JOIN producto  p  ON p.id_producto  = dv.id_producto
       JOIN categoria c  ON c.id_categoria = p.id_categoria
       WHERE ${fechaWhere}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY c.nombre_categoria
       ORDER BY total_ingresos DESC`,
      fechaParams
    );

    // ── 12. Distribución por hora del día ────────────────────────────────────
    const ventasPorHoraQ = await pool.query<{
      hora: string;
      cantidad: string;
    }>(
      `SELECT
         EXTRACT(HOUR FROM v.fecha_venta)::int::text AS hora,
         COUNT(*)::int                                AS cantidad
       FROM venta v
       WHERE ${fechaWhere}
         AND v.estado_venta != 'CANCELADO'
       GROUP BY EXTRACT(HOUR FROM v.fecha_venta)
       ORDER BY hora`,
      fechaParams
    );

    // ── 13. Comparativa vs periodo anterior (solo periodos fijos) ─────────────
    let comparativaPeriodoAnterior: {
      total_ventas_anterior: number;
      ingresos_anteriores: number;
    } | null = null;

    if (periodo !== "custom") {
      const intervalo = INTERVALOS[periodo];
      const comparQ = await pool.query<{
        total_ventas_anterior: string;
        ingresos_anteriores: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE estado_venta != 'CANCELADO')::int          AS total_ventas_anterior,
           COALESCE(
             SUM(total) FILTER (WHERE estado_venta != 'CANCELADO'), 0
           )::numeric                                                          AS ingresos_anteriores
         FROM venta
         WHERE fecha_venta >= NOW() - INTERVAL '${intervalo}' * 2
           AND fecha_venta <  NOW() - INTERVAL '${intervalo}'`
        // Sin parámetros de usuario: el intervalo viene de nuestro Map
      );
      comparativaPeriodoAnterior = {
        total_ventas_anterior: Number(comparQ.rows[0]?.total_ventas_anterior ?? 0),
        ingresos_anteriores:   Number(comparQ.rows[0]?.ingresos_anteriores   ?? 0),
      };
    }

    // ── 14. Top bodegas ───────────────────────────────────────────────────────
    //    IMPORTANTE: la tabla `venta` del schema base NO tiene id_bodega.
    //    Esa columna solo existe en ventas mayoristas creadas después de la
    //    migración. Por lo tanto usamos kardex para inferir la bodega,
    //    agrupando SALIDAS del kardex que coincidan con el periodo.
    //    Si no existe ninguna venta con bodega, devolvemos array vacío.
    //
    //    Estrategia segura: agrupar kardex SALIDA por bodega en el periodo.
    //    El alias de fecha en kardex es `fecha_movimiento`, no `fecha_venta`,
    //    así que construimos un WHERE separado para kardex.

    let kardexWhere: string;
    let kardexParams: unknown[];

    if (periodo === "custom") {
      kardexWhere = `k.fecha_movimiento >= $1::date AND k.fecha_movimiento < ($2::date + INTERVAL '1 day')`;
      kardexParams = [desde, hasta];
    } else {
      const intervalo = INTERVALOS[periodo];
      kardexWhere = `k.fecha_movimiento >= NOW() - INTERVAL '${intervalo}'`;
      kardexParams = [];
    }

    const topBodegasQ = await pool.query<{
      id_bodega: string;
      nombre_bodega: string;
      total_movimientos: string;
      total_unidades: string;
    }>(
      `SELECT
         b.id_bodega::text,
         b.nombre_bodega,
         COUNT(k.id_kardex)::int        AS total_movimientos,
         COALESCE(SUM(k.cantidad), 0)::numeric AS total_unidades
       FROM kardex k
       JOIN bodega b ON b.id_bodega = k.id_bodega
       WHERE ${kardexWhere}
         AND k.tipo_movimiento = 'SALIDA'
       GROUP BY b.id_bodega, b.nombre_bodega
       ORDER BY total_unidades DESC
       LIMIT 5`,
      kardexParams
    );

    // ─── Respuesta ────────────────────────────────────────────────────────────
    const resumen = resumenQ.rows[0];

    return NextResponse.json({
      periodo: {
        tipo:  periodo,
        desde: desde || null,
        hasta: hasta || null,
      },

      resumen: {
        total_ventas:      Number(resumen?.total_ventas      ?? 0),
        ingresos_totales:  Number(resumen?.ingresos_totales  ?? 0),
        ticket_promedio:   Number(resumen?.ticket_promedio   ?? 0),
        ventas_canceladas: Number(resumen?.ventas_canceladas ?? 0),
      },

      estadisticas_descriptivas: {
        media:               Math.round(media              * 100) / 100,
        mediana:             Math.round(mediana            * 100) / 100,
        moda:                moda.map((v) => Math.round(v  * 100) / 100),
        desviacion_estandar: Math.round(desviacionEstandar * 100) / 100,
        min_total:           Math.round(minTotal           * 100) / 100,
        max_total:           Math.round(maxTotal           * 100) / 100,
        n:                   totalesArr.length,
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
            id_producto:      Number(productoMasComprado.id_producto),
            codigo_producto:  productoMasComprado.codigo_producto,
            nombre_producto:  productoMasComprado.nombre_producto,
            unidad_medida:    productoMasComprado.unidad_medida,
            nombre_categoria: productoMasComprado.nombre_categoria,
            nombre_marca:     productoMasComprado.nombre_marca,
            total_unidades:   Number(productoMasComprado.total_unidades),
            total_ingresos:   Number(productoMasComprado.total_ingresos),
            veces_vendido:    Number(productoMasComprado.veces_vendido),
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

      top_bodegas: topBodegasQ.rows.map((r) => ({
        id_bodega:         Number(r.id_bodega),
        nombre_bodega:     r.nombre_bodega,
        total_movimientos: Number(r.total_movimientos),
        total_unidades:    Number(r.total_unidades),
      })),
    });

  } catch (error) {
    return apiError("ESTADISTICAS GET", error);
  }
}