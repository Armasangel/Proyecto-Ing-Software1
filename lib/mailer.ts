// lib/mailer.ts
//
// Envío de correo con nodemailer, usando Gmail SMTP con contraseña de
// aplicación (gratis, sin dar de alta otro servicio). Configurar en .env:
//
//   GMAIL_USER=tu_correo@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (contraseña de aplicación de Google, NO tu contraseña de la página)
//
// Cómo generar la contraseña de aplicación:
//   1. En la cuenta de Google, activar verificación en 2 pasos (la de Google, no esta).
//   2. Ir a https://myaccount.google.com/apppasswords
//   3. Crear una contraseña de aplicación para "Correo" y pegarla en GMAIL_APP_PASSWORD.

import nodemailer from "nodemailer";
import { getLogger } from "@/lib/logger";

const log = getLogger("lib/mailer");

let transporter: nodemailer.Transporter | null = null;

/**
 * ¿Estamos fuera de producción?
 *
 * Sin correo no hay forma de entregar un código 2FA, así que en desarrollo el
 * código se escribe siempre en el log del contenedor
 * (`docker compose logs -f app`) y se sigue con el flujo normal. Si el envío
 * además falla (Gmail sin configurar, contraseña de aplicación vencida, sin
 * red), el error se traga y el login continúa.
 *
 * NUNCA en producción: allí, si Gmail falla, el login falla cerrado. Saltarse
 * el 2FA porque el correo está caído sería una caída de seguridad.
 */
function esDesarrollo(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Envía el correo y, si estamos en desarrollo, deja el código anotado en el
 * log aunque el envío no funcione.
 */
async function enviarOMostrar(
  enviar: () => Promise<void>,
  destinatario: string,
  codigo: string,
  proposito: string
): Promise<void> {
  // Sólo tiene sentido mostrar un código; los correos de aviso (bloqueo,
  // cambio de contraseña) no llevan ninguno.
  if (codigo) {
    log.warn(
      { destinatario, proposito, codigo },
      "CÓDIGO DE DESARROLLO (correo no configurado o envío fallido): usa este valor en la pantalla"
    );
  }

  try {
    await enviar();
  } catch (error) {
    if (!esDesarrollo()) throw error;
    log.warn({ err: error, destinatario, proposito }, "Fallo el envío de correo en desarrollo");
  }
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Faltan SMTP_USER / SMTP_PASSWORD (o GMAIL_USER / GMAIL_APP_PASSWORD) en las variables de entorno — necesarias para enviar el código de verificación."
    );
  }

  // Si hay host explícito, se usa configuración SMTP genérica; si no, se cae
  // al preset "gmail" de nodemailer. Eso permite migrar a Mailgun, SES o al
  // servidor corporativo del negocio SIN tocar código — antes el host estaba
  // fijo en `service: "gmail"`.
  const host = process.env.SMTP_HOST;
  if (host) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });
  } else {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return transporter;
}

export async function enviarCodigoVerificacion(destinatario: string, codigo: string) {
  const remitente = process.env.GMAIL_USER;

  log.debug({ destinatario }, "Enviando código de verificación");
  await enviarOMostrar(async () => {
    await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Tu código de verificación",
    text: `Tu código de verificación es: ${codigo}\n\nExpira en 5 minutos. Si no intentaste iniciar sesión, ignora este correo.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; margin: 1rem 0;">${codigo}</p>
        <p style="color: #666; font-size: 0.85rem;">Expira en 5 minutos. Si no intentaste iniciar sesión, ignora este correo.</p>
      </div>
    `,
    });
  }, destinatario, codigo, "2fa");
}

// Se manda al correo del DUEÑO que está solicitando el ascenso (no al
// usuario que va a ser promovido), para que sea el propio dueño quien
// confirme desde su bandeja que sí quiere dar ese permiso.
export async function enviarCodigoPromocionDueno(
  destinatario: string,
  codigo: string,
  nombreObjetivo: string
) {
  const remitente = process.env.GMAIL_USER;

  log.debug({ destinatario }, "Enviando código de confirmación de promoción a dueño");
  await enviarOMostrar(async () => {
    await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Confirma el ascenso a Dueño",
    text: `Solicitaste dar el rol de Dueño a "${nombreObjetivo}". Si es correcto, confírmalo con este código: ${codigo}\n\nExpira en 5 minutos. Si no pediste esto, ignora este correo y revisa quién tiene acceso a tu cuenta.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Solicitaste dar el rol de <strong>Dueño</strong> a <strong>${nombreObjetivo}</strong>.</p>
        <p>Si es correcto, confírmalo con este código:</p>
        <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; margin: 1rem 0;">${codigo}</p>
        <p style="color: #666; font-size: 0.85rem;">Expira en 5 minutos. Si no pediste esto, ignora este correo y revisa quién tiene acceso a tu cuenta.</p>
      </div>
    `,
    });
  }, destinatario, codigo, "promocion_dueno");
}

// Recordatorio automático de deuda pendiente (ver lib/notificaciones-deuda.ts).
export async function enviarRecordatorioDeuda(
  destinatario: string,
  nombreCliente: string,
  montoPendiente: number,
  cantidadDeudas: number,
  proximaFechaLimite: string | null
) {
  const remitente = process.env.GMAIL_USER;
  const monto = montoPendiente.toFixed(2);
  const plural = cantidadDeudas === 1 ? "una cuenta pendiente" : `${cantidadDeudas} cuentas pendientes`;
  const fechaLimiteTexto = proximaFechaLimite
    ? `La fecha límite más próxima es el ${new Date(proximaFechaLimite).toLocaleDateString("es-GT")}.`
    : "";

  log.debug({ destinatario, montoPendiente }, "Enviando recordatorio de deuda");
  await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: `Recordatorio: tienes un saldo pendiente de Q${monto}`,
    text: `Hola ${nombreCliente},\n\nTenés ${plural} con Tienda San Miguel por un total de Q${monto}. ${fechaLimiteTexto}\n\nSi ya realizaste el pago, ignora este mensaje.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Hola ${nombreCliente},</p>
        <p>Tenés ${plural} por un total de:</p>
        <p style="font-size: 1.6rem; font-weight: 700; margin: 1rem 0;">Q${monto}</p>
        ${fechaLimiteTexto ? `<p style="color: #666; font-size: 0.85rem;">${fechaLimiteTexto}</p>` : ""}
        <p style="color: #666; font-size: 0.85rem;">Si ya realizaste el pago, ignora este mensaje.</p>
      </div>
    `,
  });
}

export async function enviarCodigoRecuperacion(destinatario: string, codigo: string) {
  const remitente = process.env.GMAIL_USER;

  log.debug({ destinatario }, "Enviando código de recuperación de contraseña");
  await enviarOMostrar(async () => {
    await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Código para recuperar tu contraseña",
    text: `Tu código para recuperar la contraseña es: ${codigo}\n\nExpira en 5 minutos. Si no lo pediste tú, ignora este correo.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Tu código para recuperar la contraseña es:</p>
        <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; margin: 1rem 0;">${codigo}</p>
        <p style="color: #666; font-size: 0.85rem;">Expira en 5 minutos. Si no lo pediste tú, ignora este correo.</p>
      </div>
    `,
    });
  }, destinatario, codigo, "recuperacion");
}

export async function enviarAvisoBloqueoCuenta(
  destinatario: string,
  nombreUsuario: string,
  minutosBloqueo: number,
  ip: string
) {
  const remitente = process.env.GMAIL_USER;

  log.debug({ destinatario }, "Enviando aviso de bloqueo temporal de cuenta");
  await enviarOMostrar(async () => {
    await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Tu cuenta fue bloqueada temporalmente",
    text:
      `Hola ${nombreUsuario}:\n\n` +
      `Hubo ${minutosBloqueo} intentos fallidos de iniciar sesión con tu cuenta, así que ` +
      `quedó bloqueada de forma temporal.\n\n` +
      `Dirección desde la que se intentó: ${ip}\n\n` +
      `Si fuiste vos, esperá a que expire el bloqueo e intentá de nuevo. ` +
      `Si no fuiste tú, cambia tu contraseña desde "¿Olvidaste tu contraseña?" ` +
      `en cuanto recuperes el acceso.\n\n` +
      `Si no reconoces ningún acceso, avísanos por teléfono a la tienda.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Hola ${nombreUsuario}:</p>
        <p>Hubo <strong>${minutosBloqueo} intentos fallidos</strong> de iniciar sesión con tu
        cuenta, así que quedó bloqueada de forma temporal.</p>
        <p>Dirección desde la que se intentó: <code>${ip}</code></p>
        <p>Si fuiste vos, esperá a que expire el bloqueo e intentá de nuevo. Si no fuiste vos,
        cambia tu contraseña desde <em>¿Olvidaste tu contraseña?</em> en cuanto recuperes el acceso.</p>
        <p style="color:#666; font-size: 0.85rem;">Si no reconoces ningún acceso, avísanos por teléfono a la tienda.</p>
      </div>
    `,
    });
  }, destinatario, "", "aviso_bloqueo");
}

export async function enviarAvisoCambioContrasena(
  destinatario: string,
  nombreUsuario: string,
  ip: string
) {
  const remitente = process.env.GMAIL_USER;

  log.debug({ destinatario }, "Enviando aviso de cambio de contraseña");
  await enviarOMostrar(async () => {
    await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Tu contraseña fue cambiada",
    text:
      `Hola ${nombreUsuario}:\n\nLa contraseña de tu cuenta fue cambiada recién.\n` +
      `Dirección desde la que se hizo el cambio: ${ip}\n\n` +
      `Si no fuiste vos, avisanos de inmediato: puede que alguien tenga acceso a tu correo.\n` +
      `Todos tus otros dispositivos se cerraron y tendrás que volver a iniciar sesión.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Hola ${nombreUsuario}:</p>
        <p>La contraseña de tu cuenta fue cambiada recién, desde la dirección
        <code>${ip}</code>.</p>
        <p>Todos tus otros dispositivos se cerraron y tendrás que volver a iniciar sesión.</p>
        <p style="color:#b91c1c; font-size:0.9rem;">Si no fuiste vos, avisanos de inmediato:
        puede que alguien tenga acceso a tu correo.</p>
      </div>
    `,
    });
  }, destinatario, "", "aviso_cambio_contrasena");
}