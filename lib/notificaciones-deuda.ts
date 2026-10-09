// lib/notificaciones-deuda.ts
//
// Sistema de notificación automática de deudas pendientes a clientes.
//
// Cómo funciona:
//   1. El dueño configura un intervalo en días y activa el envío
//      (configuracion_notificaciones_deuda, ver app/api/configuracion/notificaciones-deuda).
//   2. Un scheduler interno (iniciarSchedulerNotificacionesDeuda, arrancado
//      desde instrumentation.ts al iniciar el servidor) revisa cada hora si
//      hay clientes a quienes les toca un recordatorio.
//   3. "Le toca" un recordatorio a un cliente si tiene deuda pendiente > 0
//      Y (nunca se le ha notificado O su última notificación fue hace más
//      de intervalo_dias días). Se revisa por hora en vez de una vez al día
//      a una hora fija para que sea resistente a reinicios del servidor: no
//      importa cuándo se reinicie, en la próxima revisión (máximo 1 hora
//      después) se pone al día solo, sin dejar de mandar recordatorios.
//   4. Cada envío exitoso se registra en notificacion_deuda — esa bitácora
//      es la que determina cuándo le toca el siguiente a cada cliente.
//
// Diseño: se revisa por HORA (no por día) para que el intervalo en días que
// configura el dueño se cumpla con precisión de horas, no de un solo chequeo
// diario que podría no correr si el servidor estaba caído justo esa vez.

import { pool } from "@/lib/db";
import { enviarRecordatorioDeuda } from "@/lib/mailer";
import { getLogger } from "@/lib/logger";

const log = getLogger("lib/notificaciones-deuda");

export type ConfiguracionNotificacionesDeuda = {
  activo: boolean;
  intervalo_dias: number;
  actualizado_en: string;
  actualizado_por: number | null;
};

export type ClientePendienteDeNotificacion = {
  id_cliente: number;
  nombre: string;
  correo: string;
  monto_pendiente: number;
  cantidad_deudas: number;
  proxima_fecha_limite: string | null;
};

export type ResumenEjecucion = {
  activo: boolean;
  procesados: number;
  enviados: number;
  fallidos: number;
};

export async function obtenerConfiguracion(): Promise<ConfiguracionNotificacionesDeuda> {
  const result = await pool.query<ConfiguracionNotificacionesDeuda>(
    `SELECT activo, intervalo_dias, actualizado_en, actualizado_por
     FROM configuracion_notificaciones_deuda
     WHERE id = 1`
  );
  // La fila con id=1 se siembra en el init/migración — si por alguna razón
  // no existe (base editada a mano), se cae a un default seguro (apagado)
  // en vez de tronar.
  return (
    result.rows[0] ?? {
      activo: false,
      intervalo_dias: 7,
      actualizado_en: new Date().toISOString(),
      actualizado_por: null,
    }
  );
}

export async function actualizarConfiguracion(
  cambios: { activo?: boolean; intervalo_dias?: number },
  idUsuario: number
): Promise<ConfiguracionNotificacionesDeuda> {
  const actual = await obtenerConfiguracion();
  const activo = cambios.activo ?? actual.activo;
  const intervalo_dias = cambios.intervalo_dias ?? actual.intervalo_dias;

  const result = await pool.query<ConfiguracionNotificacionesDeuda>(
    `UPDATE configuracion_notificaciones_deuda
     SET activo = $1, intervalo_dias = $2, actualizado_en = NOW(), actualizado_por = $3
     WHERE id = 1
     RETURNING activo, intervalo_dias, actualizado_en, actualizado_por`,
    [activo, intervalo_dias, idUsuario]
  );
  return result.rows[0];
}

// Clientes a los que ya les toca un recordatorio: tienen deuda pendiente
// mayor a 0, tienen correo registrado, y nunca se les ha notificado o su
// última notificación fue hace más de `intervaloDias` días.
export async function clientesPendientesDeNotificacion(
  intervaloDias: number
): Promise<ClientePendienteDeNotificacion[]> {
  const result = await pool.query<ClientePendienteDeNotificacion>(
    `WITH deuda_pendiente AS (
       SELECT
         d.id_cliente,
         SUM(GREATEST(d.monto_total - COALESCE(pg.total_pagado, 0), 0)) AS monto_pendiente,
         COUNT(*)::int AS cantidad_deudas,
         MIN(d.fecha_limite_pago) AS proxima_fecha_limite
       FROM deuda d
       LEFT JOIN (
         SELECT id_deuda, SUM(monto) AS total_pagado FROM pago_deuda GROUP BY id_deuda
       ) pg ON pg.id_deuda = d.id_deuda
       WHERE d.estado_deuda = 'PENDIENTE' AND d.id_cliente IS NOT NULL
       GROUP BY d.id_cliente
       HAVING SUM(GREATEST(d.monto_total - COALESCE(pg.total_pagado, 0), 0)) > 0
     ),
     ultima_notificacion AS (
       SELECT DISTINCT ON (id_cliente) id_cliente, enviado_en
       FROM notificacion_deuda
       ORDER BY id_cliente, enviado_en DESC
     )
     SELECT
       c.id_cliente, c.nombre, c.correo,
       dp.monto_pendiente, dp.cantidad_deudas, dp.proxima_fecha_limite
     FROM deuda_pendiente dp
     JOIN cliente c ON c.id_cliente = dp.id_cliente
     LEFT JOIN ultima_notificacion un ON un.id_cliente = dp.id_cliente
     WHERE c.correo IS NOT NULL
       AND (un.enviado_en IS NULL OR un.enviado_en <= NOW() - make_interval(days => $1::int))
     ORDER BY dp.monto_pendiente DESC`,
    [intervaloDias]
  );
  return result.rows;
}

// El job en sí: lo llama tanto el scheduler automático como el botón
// "enviar ahora" del dueño. Sigue de largo si un correo individual falla,
// para que un cliente con el correo mal no trabe a los demás.
export async function ejecutarNotificacionesDeuda(): Promise<ResumenEjecucion> {
  const config = await obtenerConfiguracion();
  if (!config.activo) {
    return { activo: false, procesados: 0, enviados: 0, fallidos: 0 };
  }

  const clientes = await clientesPendientesDeNotificacion(config.intervalo_dias);
  let enviados = 0;
  let fallidos = 0;

  for (const c of clientes) {
    try {
      await enviarRecordatorioDeuda(c.correo, c.nombre, c.monto_pendiente, c.cantidad_deudas, c.proxima_fecha_limite);
      await pool.query(
        `INSERT INTO notificacion_deuda (id_cliente, monto_notificado, cantidad_deudas)
         VALUES ($1, $2, $3)`,
        [c.id_cliente, c.monto_pendiente, c.cantidad_deudas]
      );
      enviados++;
    } catch (err) {
      fallidos++;
      log.error({ err, id_cliente: c.id_cliente }, "No se pudo enviar el recordatorio de deuda a este cliente");
    }
  }

  log.info(
    { procesados: clientes.length, enviados, fallidos, intervalo_dias: config.intervalo_dias },
    "Corrida de notificaciones de deuda terminada"
  );

  return { activo: true, procesados: clientes.length, enviados, fallidos };
}

const INTERVALO_CHEQUEO_MS = 60 * 60 * 1000; // revisa cada hora si a alguien ya le toca
const RETRASO_INICIAL_MS = 30_000; // deja que el server termine de arrancar antes del primer chequeo

declare global {
  // eslint-disable-next-line no-var
  var _schedulerNotificacionesDeudaIniciado: boolean | undefined;
}

// Arranca el scheduler interno. Se llama una sola vez, desde
// instrumentation.ts, al iniciar el servidor. La bandera en globalThis evita
// que quede duplicado si Next.js llama register() más de una vez (pasa en
// desarrollo con el recompilado en caliente).
export function iniciarSchedulerNotificacionesDeuda(): void {
  if (globalThis._schedulerNotificacionesDeudaIniciado) return;
  globalThis._schedulerNotificacionesDeudaIniciado = true;

  const ejecutar = () => {
    ejecutarNotificacionesDeuda().catch((err) => {
      log.error({ err }, "Error corriendo el job de notificaciones de deuda");
    });
  };

  setTimeout(ejecutar, RETRASO_INICIAL_MS);
  setInterval(ejecutar, INTERVALO_CHEQUEO_MS);

  log.info(
    { revisa_cada_ms: INTERVALO_CHEQUEO_MS },
    "Scheduler de notificaciones de deuda iniciado"
  );
}
