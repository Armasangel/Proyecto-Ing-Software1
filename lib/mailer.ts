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

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Faltan GMAIL_USER / GMAIL_APP_PASSWORD en las variables de entorno — necesarias para enviar el código de verificación."
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return transporter;
}

export async function enviarCodigoVerificacion(destinatario: string, codigo: string) {
  const remitente = process.env.GMAIL_USER;

  log.debug({ destinatario }, "Enviando código de verificación");
  await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Tu código de verificación",
    text: `Tu código de verificación es: ${codigo}\n\nExpira en 5 minutos. Si no intentaste iniciar sesión, ignorá este correo.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; margin: 1rem 0;">${codigo}</p>
        <p style="color: #666; font-size: 0.85rem;">Expira en 5 minutos. Si no intentaste iniciar sesión, ignorá este correo.</p>
      </div>
    `,
  });
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
  await getTransporter().sendMail({
    from: `"Tienda San Miguel" <${remitente}>`,
    to: destinatario,
    subject: "Confirmá el ascenso a Dueño",
    text: `Solicitaste dar el rol de Dueño a "${nombreObjetivo}". Si es correcto, confirmalo con este código: ${codigo}\n\nExpira en 5 minutos. Si vos no pediste esto, ignorá este correo y revisá quién tiene acceso a tu cuenta.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 0.5rem;">Tienda San Miguel</h2>
        <p>Solicitaste dar el rol de <strong>Dueño</strong> a <strong>${nombreObjetivo}</strong>.</p>
        <p>Si es correcto, confirmalo con este código:</p>
        <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; margin: 1rem 0;">${codigo}</p>
        <p style="color: #666; font-size: 0.85rem;">Expira en 5 minutos. Si vos no pediste esto, ignorá este correo y revisá quién tiene acceso a tu cuenta.</p>
      </div>
    `,
  });
}