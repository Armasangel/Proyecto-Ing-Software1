// instrumentation.ts
//
// Hook de Next.js (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
// que corre UNA vez cuando arranca una nueva instancia del servidor —
// aquí es donde arrancamos procesos de fondo de larga duración, como el
// scheduler de notificaciones automáticas de deuda.
//
// El guard de NEXT_RUNTIME evita correr esto en el runtime "edge" (donde
// no existen setInterval de larga duración ni conexión directa a Postgres).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarSchedulerNotificacionesDeuda } = await import("@/lib/notificaciones-deuda");
    iniciarSchedulerNotificacionesDeuda();
  }
}
