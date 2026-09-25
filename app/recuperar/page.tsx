"use client";

/* Recuperación de contraseña ("olvidé mi contraseña").
   Flujo en 3 pasos dentro de la misma página:
   1. Correo → se manda un código de 6 dígitos (respuesta genérica: no se
      revela si el correo existe).
   2. Código → si es correcto, se recibe un reset_token de corta duración.
   3. Contraseña nueva → se actualiza y se redirige al login. */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full bg-white border border-[var(--border)] rounded-control px-4 py-3 text-ink text-[0.95rem] outline-none transition-shadow focus:ring-2 focus:ring-market/40";
const labelCls = "text-[0.85rem] font-medium text-ink-muted";

export default function RecuperarPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<"correo" | "codigo" | "nueva">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);

  const titulos: Record<typeof paso, string> = {
    correo: "Recuperar contraseña",
    codigo: "Verificá tu identidad",
    nueva: "Nueva contraseña",
  };

  const subtitulos: Record<typeof paso, string> = {
    correo: "Ingresá el correo de tu cuenta y te enviaremos un código de 6 dígitos.",
    codigo: "Ingresá el código que te enviamos para continuar.",
    nueva: "Elegí una contraseña nueva. Requiere al menos 6 caracteres.",
  };

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    setLoading(true);
    try {
      const res = await fetch("/api/recuperar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo enviar el código");
        return;
      }
      // Respuesta genérica: se muestre o no el mensaje "no registrado",
      // avanzamos al paso del código.
      setPaso("codigo");
      setCodigo("");
      setAviso(data.message || "Si el correo está registrado, ya te enviamos el código.");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/recuperar/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, codigo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Código incorrecto");
        return;
      }
      setResetToken(data.reset_token);
      setPaso("nueva");
      setAviso("");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function handleCambiar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nuevaContrasena !== confirmarContrasena) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/recuperar/cambiar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_token: resetToken, nueva_contrasena: nuevaContrasena }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar la contraseña");
        return;
      }
      router.push("/login");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviar() {
    setError("");
    setAviso("");
    setLoading(true);
    try {
      const res = await fetch("/api/recuperar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo reenviar el código");
        return;
      }
      setCodigo("");
      setAviso("Te mandamos un código nuevo.");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  function renderCuerpo() {
    if (paso === "correo") {
      return (
        <form onSubmit={handleSolicitar} className="flex flex-col gap-5 mb-5">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Correo electrónico</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="usuario@tienda.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              autoFocus
              className={inputCls}
            />
          </div>

          {error && (
            <div className="bg-achiote-50 border border-achiote/25 rounded-control px-4 py-3 text-achiote-600 text-[0.88rem]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-market text-white border-none rounded-control py-3.5 font-head text-[0.95rem] font-bold transition-transform active:scale-[0.98] hover:brightness-110 disabled:opacity-70"
          >
            {loading ? "Enviando…" : "Enviar código"}
          </button>
        </form>
      );
    }

    if (paso === "codigo") {
      return (
        <form onSubmit={handleVerificar} className="flex flex-col gap-5 mb-5">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Código de 6 dígitos</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
              autoFocus
              className={`${inputCls} tracking-[0.4em] text-center text-xl`}
            />
          </div>

          {aviso && (
            <div className="bg-market-50 border border-market/25 rounded-control px-4 py-3 text-market-600 text-[0.85rem] animate-toast-in">
              {aviso}
            </div>
          )}

          {error && (
            <div className="bg-achiote-50 border border-achiote/25 rounded-control px-4 py-3 text-achiote-600 text-[0.88rem]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || codigo.length !== 6}
            className="w-full bg-market text-white border-none rounded-control py-3.5 font-head text-[0.95rem] font-bold transition-transform active:scale-[0.98] hover:brightness-110 disabled:opacity-70"
          >
            {loading ? "Verificando…" : "Continuar"}
          </button>

          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={handleReenviar}
              disabled={loading}
              className="bg-transparent border-none text-market-600 text-[0.82rem] font-medium p-0 disabled:opacity-60 hover:underline"
            >
              {loading ? "Reenviando…" : "Reenviar código"}
            </button>
            <button
              type="button"
              onClick={() => setPaso("correo")}
              disabled={loading}
              className="bg-transparent border-none text-market-600 text-[0.82rem] font-medium p-0 disabled:opacity-60 hover:underline"
            >
              Usar otro correo
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={handleCambiar} className="flex flex-col gap-5 mb-5">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Contraseña nueva</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={nuevaContrasena}
            onChange={(e) => setNuevaContrasena(e.target.value)}
            required
            minLength={6}
            autoFocus
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Confirmar contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmarContrasena}
            onChange={(e) => setConfirmarContrasena(e.target.value)}
            required
            minLength={6}
            className={inputCls}
          />
        </div>

        {error && (
          <div className="bg-achiote-50 border border-achiote/25 rounded-control px-4 py-3 text-achiote-600 text-[0.88rem]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || nuevaContrasena.length < 6 || nuevaContrasena !== confirmarContrasena}
          className="w-full bg-market text-white border-none rounded-control py-3.5 font-head text-[0.95rem] font-bold transition-transform active:scale-[0.98] hover:brightness-110 disabled:opacity-70"
        >
          {loading ? "Guardando…" : "Guardar nueva contraseña"}
        </button>

        <button
          type="button"
          onClick={() => setPaso("codigo")}
          disabled={loading}
          className="bg-transparent border-none text-market-600 text-[0.82rem] font-medium p-0 disabled:opacity-60 hover:underline"
        >
          Volver al código
        </button>
      </form>
    );
  }

  return (
    <main className="min-h-screen flex font-body bg-cream">

      {/* ── Panel izquierdo: branding — oculto en móvil, aparece desde md ── */}
      <div className="hidden md:flex md:flex-[0_0_42%] bg-sidebar items-center p-12">
        <div className="flex flex-col gap-8 max-w-[340px]">
          <div className="flex flex-col gap-1.5">
            <p className="text-[0.78rem] font-semibold text-market-100 tracking-widest uppercase m-0">
              Sistema de gestión
            </p>
            <h1 className="font-head text-[2.2rem] font-extrabold text-cream leading-tight m-0">
              Tienda San Miguel
            </h1>
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-[0.92rem] text-cream/85 leading-relaxed m-0">
              Plataforma de inventario y ventas para mayoristas de Guatemala.
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
              {[
                "Recuperá el acceso a tu cuenta por correo",
                "Válido para dueño, colaboradores y bodegueros",
                "Código de un solo uso con vencimiento corto",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[0.88rem] text-mango-100/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-market shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-cream">
        <div className="w-full max-w-[420px]">

          <div className="md:hidden mb-6 text-center">
            <h1 className="font-head text-2xl font-extrabold text-ink m-0">Tienda San Miguel</h1>
          </div>

          <div className="mb-8">
            <h2 className="font-head text-[1.8rem] font-bold text-ink mb-1.5">{titulos[paso]}</h2>
            <p className="text-ink-muted text-[0.9rem] m-0">{subtitulos[paso]}</p>
          </div>

          {renderCuerpo()}

          <p className="text-center text-[0.85rem] text-ink-muted mt-2">
            ¿Recordás tu contraseña?{" "}
            <Link href="/login" className="text-market-600 font-medium hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}