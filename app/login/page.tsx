"use client";

/* Página de login.
   Panel izquierdo: branding cálido (visible desde md hacia arriba).
   Panel derecho: formulario, siempre visible — en móvil ocupa toda la pantalla. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postLoginPath } from "@/lib/roles";

const inputCls =
  "w-full bg-white border border-[var(--border)] rounded-control px-4 py-3 text-ink text-[0.95rem] outline-none transition-shadow focus:ring-2 focus:ring-market/40";
const labelCls = "text-[0.85rem] font-medium text-ink-muted";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Paso 2: verificación del código de 6 dígitos.
  const [paso, setPaso] = useState<"credenciales" | "codigo">("credenciales");
  const [preToken, setPreToken] = useState("");
  const [correoEnmascarado, setCorreoEnmascarado] = useState("");
  const [codigo, setCodigo] = useState("");
  const [reenviando, setReenviando] = useState(false);
  const [avisoReenvio, setAvisoReenvio] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }
      // Solo los colaboradores pasan por el código de 2FA. El dueño
      // entra directo con el AUTH_COOKIE que ya viene en la respuesta.
      if (data.requiere_verificacion) {
        setPreToken(data.pre_token);
        setCorreoEnmascarado(data.correo_enmascarado || "");
        setPaso("codigo");
      } else {
        const dest =
          data.usuario?.tipo_usuario != null
            ? postLoginPath(data.usuario.tipo_usuario)
            : "/dashboard";
        router.push(dest);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login/verificar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_token: preToken, codigo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Código incorrecto");
        return;
      }
      const dest =
        data.usuario?.tipo_usuario != null
          ? postLoginPath(data.usuario.tipo_usuario)
          : "/dashboard";
      router.push(dest);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviarCodigo() {
    setError("");
    setAvisoReenvio("");
    setReenviando(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo reenviar el código");
        return;
      }
      setPreToken(data.pre_token);
      setCorreoEnmascarado(data.correo_enmascarado || "");
      setCodigo("");
      setAvisoReenvio("Te mandamos un código nuevo.");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setReenviando(false);
    }
  }

  function handleVolver() {
    setPaso("credenciales");
    setCodigo("");
    setError("");
    setAvisoReenvio("");
    setPreToken("");
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
                "Control de inventario en tiempo real",
                "Ventas mayoristas y minoristas",
                "Kardex y trazabilidad",
                "Reportes y facturación",
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

          {/* En móvil, ya que no hay panel de branding, mostramos el nombre aquí */}
          <div className="md:hidden mb-6 text-center">
            <p className="text-[0.72rem] font-semibold text-market-600 tracking-widest uppercase m-0">
              Sistema de gestión
            </p>
            <h1 className="font-head text-2xl font-extrabold text-ink m-0">Tienda San Miguel</h1>
          </div>

          <div className="mb-8">
            <h2 className="font-head text-[1.8rem] font-bold text-ink mb-1.5">
              {paso === "credenciales" ? "Bienvenido de vuelta" : "Verificá tu identidad"}
            </h2>
            <p className="text-ink-muted text-[0.9rem] m-0">
              {paso === "credenciales"
                ? "Ingresa tus credenciales para continuar"
                : `Te mandamos un código de 6 dígitos a ${correoEnmascarado || "tu correo"}`}
            </p>
          </div>

          {paso === "credenciales" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5 mb-5">

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Correo electrónico</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="usuario@tienda.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Contraseña</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                {loading ? "Ingresando…" : "Ingresar al sistema"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerificarCodigo} className="flex flex-col gap-5 mb-5">

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Código de verificación</label>
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

              {error && (
                <div className="bg-achiote-50 border border-achiote/25 rounded-control px-4 py-3 text-achiote-600 text-[0.88rem]">
                  {error}
                </div>
              )}

              {avisoReenvio && (
                <div className="bg-market-50 border border-market/25 rounded-control px-4 py-3 text-market-600 text-[0.85rem] animate-toast-in">
                  {avisoReenvio}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || codigo.length !== 6}
                className="w-full bg-market text-white border-none rounded-control py-3.5 font-head text-[0.95rem] font-bold transition-transform active:scale-[0.98] hover:brightness-110 disabled:opacity-70"
              >
                {loading ? "Verificando…" : "Verificar y entrar"}
              </button>

              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={handleReenviarCodigo}
                  disabled={reenviando}
                  className="bg-transparent border-none text-market-600 text-[0.82rem] font-medium p-0 disabled:opacity-60 hover:underline"
                >
                  {reenviando ? "Reenviando…" : "Reenviar código"}
                </button>
                <button
                  type="button"
                  onClick={handleVolver}
                  className="bg-transparent border-none text-market-600 text-[0.82rem] font-medium p-0 hover:underline"
                >
                  Usar otra cuenta
                </button>
              </div>
            </form>
          )}

          {/* Usuarios de prueba */}
          {paso === "credenciales" && (
            <div className="mt-5 p-4 bg-white rounded-card border border-[var(--border)]">
              <p className="text-ink-muted text-[0.78rem] mb-2 m-0">Usuarios de prueba (password123):</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Dueño (entra directo)", correo: "dueno@tienda.com" },
                  { label: "Colaborador (2FA por correo)", correo: "armasangel193@gmail.com" },
                ].map((u) => (
                  <button
                    key={u.correo}
                    type="button"
                    onClick={() => setUsername(u.correo)}
                    className="bg-cream border border-[var(--border)] rounded-control px-3 py-1.5 text-ink text-[0.78rem] transition-colors hover:bg-market-50 hover:border-market/30"
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
