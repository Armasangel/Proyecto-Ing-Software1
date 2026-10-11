"use client";

/* Mi cuenta: gestión de credenciales por el propio usuario.
 *
 * Antes, cambiar la contraseña sólo era posible con "olvidé mi contraseña":
 * no había forma de rotarla voluntariamente. Esta pantalla cubre las tres
 * acciones de seguridad que un usuario debe poder hacer sin pedirle nada a un
 * dueño — cambiar su contraseña, ver desde dónde entró la última vez, y
 * expulsar a alguien que haya quedado con su sesión.
 *
 * Nota: tanto cambiar la contraseña como cerrar las sesiones invalidan los
 * tokens emitidos hasta el momento, incluido el de esta sesión, así que
 * ambas acciones terminan redirigiendo al login. Es a propósito. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMiSesion } from "@/hooks/useMiSesion";
import { StaffShell } from "@/components/StaffShell";
import { Icon } from "@/components/Icon";

type Cuenta = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
  rol_label: string;
  requiere_2fa: boolean;
  ultimo_login_en: string | null;
  ultimo_login_ip: string | null;
};

const inputCls =
  "w-full bg-white border border-[var(--border)] rounded-control px-4 py-3 text-ink text-[0.95rem] outline-none transition-shadow focus:ring-2 focus:ring-market/40";

function formatoFecha(iso: string | null): string {
  if (!iso) return "Sin registro";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin registro";
  return d.toLocaleString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MiCuentaPage() {
  const usuario = useMiSesion();
  const router = useRouter();

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cerrandoSesiones, setCerrandoSesiones] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/usuarios/mi-cuenta");
      if (!res.ok) return;
      const data = await res.json();
      setCuenta(data.cuenta);
    } catch {
      // La pantalla degrada a "sin datos" sin romper la navegación.
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");

    if (nueva !== confirmacion) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/usuarios/mi-contrasena", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrasena_actual: actual, nueva_contrasena: nueva }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña");
        return;
      }

      // El cambio cerró todas las sesiones: esta cookie ya no sirve.
      router.replace("/login");
    } catch {
      setError("No se pudo cambiar la contraseña. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function handleCerrarSesiones() {
    setCerrandoSesiones(true);
    try {
      await fetch("/api/usuarios/mi-sesiones/cerrar", { method: "POST" });
      router.replace("/login");
    } catch {
      setError("No se pudieron cerrar las sesiones. Intentá de nuevo.");
      setCerrandoSesiones(false);
    }
  }

  if (!usuario) return null;

  const cardCls = "bg-white border border-[var(--border)] rounded-card p-6 mb-6";

  return (
    <StaffShell
      usuario={usuario}
      title="Mi cuenta"
      subtitle="Tu contraseña, tu sesión y cuándo entrando por última vez."
    >
      {/* Estado de seguridad */}
      <section className={cardCls}>
        <h2 className="font-head text-[1.1rem] font-bold mb-4 text-ink">Tu cuenta</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-[0.9rem]">
          <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <dt className="text-ink-muted">Nombre</dt>
            <dd className="font-medium text-ink">{cuenta?.nombre ?? usuario.nombre}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <dt className="text-ink-muted">Correo</dt>
            <dd className="font-medium text-ink truncate">{cuenta?.correo ?? usuario.correo}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <dt className="text-ink-muted">Rol</dt>
            <dd className="font-medium text-ink">{cuenta?.rol_label ?? usuario.tipo_usuario}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <dt className="text-ink-muted">Verificación en 2 pasos</dt>
            <dd className="font-medium text-ink">
              {cuenta ? (cuenta.requiere_2fa ? "Activa" : "Desactivada") : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <dt className="text-ink-muted">Último acceso</dt>
            <dd className="font-medium text-ink">{formatoFecha(cuenta?.ultimo_login_en ?? null)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <dt className="text-ink-muted">Desde</dt>
            <dd className="font-medium text-ink">{cuenta?.ultimo_login_ip ?? "Sin registro"}</dd>
          </div>
        </dl>

        {cuenta && !cuenta.requiere_2fa && (
          <p className="mt-4 text-[0.85rem] text-ink-muted bg-market/10 border border-market/20 rounded-control px-4 py-3">
            Tu cuenta no pide un segundo paso al iniciar sesión. Si sos dueño o
            colaborador, pedile al dueño que lo active: es la protección que
            evita que una contraseña robada alcance la caja.
          </p>
        )}
      </section>

      {/* Cambiar contraseña */}
      <section className={cardCls}>
        <h2 className="font-head text-[1.1rem] font-bold mb-1 text-ink">Cambiar contraseña</h2>
        <p className="text-[0.85rem] text-ink-muted mb-4">
          Necesitás tu contraseña actual. Al cambiarla se cierran todas tus
          sesiones, incluida esta, y te mandamos un aviso al correo.
        </p>

        <form onSubmit={handleCambiarPassword} className="max-w-md space-y-4">
          <div>
            <label htmlFor="pw-actual" className="block text-[0.85rem] font-medium text-ink-muted mb-1.5">
              Contraseña actual
            </label>
            <input
              id="pw-actual"
              type="password"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label htmlFor="pw-nueva" className="block text-[0.85rem] font-medium text-ink-muted mb-1.5">
              Contraseña nueva
            </label>
            <input
              id="pw-nueva"
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              className={inputCls}
              required
            />
            <p className="text-[0.78rem] text-ink-muted mt-1.5">
              Mínimo 12 caracteres. Una frase larga es más segura y más fácil de
              recordar que una corta con símbolos.
            </p>
          </div>

          <div>
            <label htmlFor="pw-confirmacion" className="block text-[0.85rem] font-medium text-ink-muted mb-1.5">
              Repetí la contraseña nueva
            </label>
            <input
              id="pw-confirmacion"
              type="password"
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-[0.85rem] text-[var(--danger)] bg-danger/10 border border-danger/25 rounded-control px-3 py-2">
              {error}
            </p>
          )}
          {aviso && (
            <p className="text-[0.85rem] text-ink bg-market/10 border border-market/20 rounded-control px-3 py-2">
              {aviso}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando || !actual || !nueva || !confirmacion}
            className="inline-flex items-center gap-2 bg-market text-white rounded-control px-5 py-2.5 text-[0.9rem] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="lockout" size={15} variant="light" />
            {guardando ? "Cambiando…" : "Cambiar contraseña"}
          </button>
        </form>
      </section>

      {/* Cerrar sesiones */}
      <section className={cardCls}>
        <h2 className="font-head text-[1.1rem] font-bold mb-1 text-ink">Cerrar todas mis sesiones</h2>
        <p className="text-[0.85rem] text-ink-muted mb-4">
          Si creés que alguien más entró con tu cuenta, cerrá todo de golpe:
          queda deslogueado de inmediato en cada dispositivo, sin esperar a que
          la sesión expire. Vas a tener que volver a iniciar sesión acá también.
        </p>

        {confirmarCierre ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCerrarSesiones}
              disabled={cerrandoSesiones}
              className="inline-flex items-center gap-2 bg-[var(--danger)] text-white rounded-control px-5 py-2.5 text-[0.9rem] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {cerrandoSesiones ? "Cerrando…" : "Sí, cerrar todas mis sesiones"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmarCierre(false)}
              className="rounded-control border border-[var(--border)] px-4 py-2.5 text-[0.88rem] text-ink-muted hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmarCierre(true)}
            className="inline-flex items-center gap-2 rounded-control border border-[var(--border)] px-5 py-2.5 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-white"
          >
            <Icon name="logout" size={15} variant="dark" />
            Cerrar todas mis sesiones
          </button>
        )}
      </section>
    </StaffShell>
  );
}