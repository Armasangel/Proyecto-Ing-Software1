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