//manejo de erores consistente para todos los endpoints
//NUNCA exponer stack traces o mensajes internos al cliente.

import { NextResponse } from "next/server";

//Logea el error en el servidor y devuelve una respuesta genérica al cliente
//Usar en todos los catch de las rutas de API.

export function apiError(
  context: string,
  error: unknown,
  status = 500
): NextResponse {
  // El detalle completo solo va al servidor (logs de Docker / servidor)
  console.error(`[${context}]`, error);
 
  return NextResponse.json(
    { error: "Error interno del servidor" },
    { status }
  );
}
 
//Respuesta de error de validación (400) — estos SÍ se muestran al cliente 
// porque son errores del usuario, no del servidor.
export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
 
 // Respuesta de no autorizado (403)
export function unauthorizedError(): NextResponse {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}