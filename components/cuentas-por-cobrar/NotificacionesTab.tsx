"use client";

import type { CuentasPorCobrarController } from "@/hooks/useCuentasPorCobrar";

export function NotificacionesTab({ h }: { h: CuentasPorCobrarController }) {
  return (
    <div className="max-w-[560px]">
      <h3 className="mb-[0.4rem]">Recordatorios automáticos de cobro</h3>
      <p className="text-ink-muted text-[0.88rem] leading-[1.6] mb-5">
        Cuando está activo, el sistema revisa cada hora si algún cliente con saldo por cobrar y
        correo registrado no ha recibido un recordatorio en los últimos días que configures acá, y
        le manda uno automáticamente por correo.
      </p>

      {h.notifConfig === null ? (
        <p className="text-ink-muted">Cargando…</p>
      ) : (
        <div className="border border-line rounded-[14px] p-5 flex flex-col gap-[1.1rem]">
          <label className="flex items-center gap-[0.6rem] cursor-pointer">
            <input
              type="checkbox"
              checked={h.notifConfig.activo}
              disabled={h.notifGuardando}
              onChange={(e) => h.guardarNotifConfig({ activo: e.target.checked })}
            />
            <span className="font-semibold">
              Envío automático {h.notifConfig.activo ? "activado" : "desactivado"}
            </span>
          </label>

          <div>
            <label className="block font-semibold mb-[0.4rem] text-[0.88rem]">
              Recordar cada (días)
            </label>
            <div className="flex gap-[0.6rem] items-center">
              <input
                type="number"
                min={1}
                max={365}
                value={h.notifIntervaloInput}
                onChange={(e) => h.setNotifIntervaloInput(e.target.value)}
                className="w-[100px] px-[0.7rem] py-2 rounded-[10px] border border-line"
              />
              <button
                type="button"
                disabled={
                  h.notifGuardando ||
                  !h.notifIntervaloInput ||
                  Number(h.notifIntervaloInput) === h.notifConfig.intervalo_dias
                }
                onClick={() =>
                  h.guardarNotifConfig({ intervalo_dias: Number(h.notifIntervaloInput) })
                }
                className="px-4 py-2 rounded-[10px] border border-line bg-surface-soft cursor-pointer font-semibold"
              >
                {h.notifGuardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
            <p className="text-ink-muted text-[0.78rem] mt-[0.4rem]">
              A cada cliente con saldo por cobrar se le vuelve a recordar cuando pasan al menos este
              número de días desde su último recordatorio (o desde nunca, si es la primera vez).
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={h.ejecutarNotifAhora}
              disabled={h.notifEjecutando || !h.notifConfig.activo}
              title={!h.notifConfig.activo ? "Activa el envío automático primero" : undefined}
              className={`px-[1.2rem] py-[0.55rem] rounded-[14px] bg-success text-white border-none font-semibold ${
                h.notifConfig.activo ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-60"
              }`}
            >
              {h.notifEjecutando ? "Enviando…" : "Enviar ahora"}
            </button>
            <p className="text-ink-muted text-[0.78rem] mt-2">
              Fuerza una corrida inmediata (sin esperar a la revisión automática). Solo les llegará a
              quienes ya les tocaba según el intervalo de arriba.
            </p>
          </div>

          {h.notifMensaje && <p className="text-success font-semibold m-0">{h.notifMensaje}</p>}
          {h.notifError && <p className="text-danger font-semibold m-0">{h.notifError}</p>}
        </div>
      )}
    </div>
  );
}
