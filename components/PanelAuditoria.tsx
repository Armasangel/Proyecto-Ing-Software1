"use client";

/* Panel de bitácora de credenciales (sólo dueño).
 *
 * Lee GET /api/usuarios/auditoria. Responde las preguntas que el log de pino
 * no puede contestar: quién entró, desde qué IP, qué cuenta está siendo
 * atacada, y cuándo se cambió una contraseña o un permiso.
 *
 * Sólo lectura a propósito: los eventos se escriben desde los flujos de
 * autenticación, nunca desde acá. Un panel de auditoría editable no es una
 * bitácora. */

import { useCallback, useEffect, useState } from "react";

type Registro = {
  id: number;
  id_usuario: number | null;
  correo: string | null;
  tipo_evento: string;
  ip: string | null;
  user_agent: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
  nombre_usuario: string | null;
};

type Respuesta = {
  registros: Registro[];
  total: number;
  pagina: number;
  por_pagina: number;
  etiquetas: Record<string, string>;
};

/** Colores por tipo: lo que hay que mirar primero, en rojo. */
const TONO: Record<string, string> = {
  CUENTA_BLOQUEADA: "bg-danger/10 text-[var(--danger)] border-danger/25",
  LOGIN_FALLIDO: "bg-market/10 text-[var(--market)] border-market/25",
  PASSWORD_RESET_SOLICITADO: "bg-market/10 text-[var(--market)] border-market/25",
  PASSWORD_CAMBIO: "bg-market/10 text-[var(--market)] border-market/25",
  PASSWORD_CAMBIO_RECHAZADO: "bg-danger/10 text-[var(--danger)] border-danger/25",
  SESIONES_REVOCADAS: "bg-market/10 text-[var(--market)] border-market/25",
  USUARIO_DESHABILITADO: "bg-danger/10 text-[var(--danger)] border-danger/25",
  LOGIN_OK: "bg-green/10 text-[var(--green)] border-green/25",
  ROL_CAMBIADO: "bg-neutral-200 text-ink-muted border-[var(--border)]",
  USUARIO_CREADO: "bg-neutral-200 text-ink-muted border-[var(--border)]",
  PROMOCION_DUENO: "bg-neutral-200 text-ink-muted border-[var(--border)]",
  LOGOUT: "bg-neutral-200 text-ink-muted border-[var(--border)]",
};

const inputCls =
  "bg-white border border-[var(--border)] rounded-control px-3 py-2 text-[0.85rem] text-ink outline-none focus:ring-2 focus:ring-market/40";

/** "qué pasó" legible a partir del detalle JSONB. */
function resumirDetalle(tipo: string, detalle: Record<string, unknown> | null): string {
  if (!detalle) return "";
  const d = detalle as Record<string, string | boolean | number>;

  if (d.motivo === "correo_no_registrado") return "El correo no corresponde a ninguna cuenta";
  if (d.motivo === "contrasena_incorrecta") return "Contraseña incorrecta";
  if (d.motivo === "requiere_cambio_contrasena") return "Debe cambiar su contraseña";
  if (d.motivo === "contrasena_actual_incorrecta") return "La contraseña actual no era correcta";
  if (d.via === "mi_cuenta") return "Cambio voluntary desde Mi cuenta";
  if (d.via === "recuperacion") return "Restablecida por recuperación con código";
  if (d.desde && d.hacia) return `De ${String(d.desde)} a ${String(d.hacia)}`;
  if (d.desde && d.hacia === undefined && d.tipo_usuario) return `Rol: ${String(d.tipo_usuario)}`;

  const cambios: string[] = [];
  for (const campo of ["tipo_usuario", "estado_usuario", "requiere_2fa", "id_bodega"]) {
    if (campo in d) cambios.push(campo.replace(/_/g, " "));
  }
  if (cambios.length) return `Cambió: ${cambios.join(", ")}`;
  if (d.con_2fa === false) return "Sin segundo paso de verificación";
  if (d.con_2fa === true) return "Con segundo paso de verificación";
  if (d.minutos) return `Bloqueada por ${d.minutos} minutos`;
  return "";
}

function formatoFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanelAuditoria() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina: String(pagina), por_pagina: "25" });
      if (q.trim()) params.set("q", q.trim());
      if (tipo) params.set("tipo", tipo);

      const res = await fetch(`/api/usuarios/auditoria?${params.toString()}`);
      if (!res.ok) return;
      setDatos(await res.json());
    } catch {
      // El panel es informativo: si falla, no interrumpe la gestión de usuarios.
    } finally {
      setCargando(false);
    }
  }, [pagina, q, tipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

  return (
    <section className="mt-8 bg-white border border-[var(--border)] rounded-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-head text-[1.1rem] font-bold text-ink">Bitácora de acceso</h2>
        {datos && (
          <span className="text-[0.8rem] text-ink-muted">
            {datos.total} evento{datos.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-[0.83rem] text-ink-muted mb-4">
        Entradas, contraseñas, bloqueos y cambios de permisos. Si algo no
        coincide con lo que reconocés, cambiá tu contraseña y cerrá tus sesiones
        desde <strong>Mi cuenta</strong>.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar por correo"
          className={inputCls}
        />
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setPagina(1);
          }}
          className={inputCls}
        >
          <option value="">Todos los eventos</option>
          {datos &&
            Object.entries(datos.etiquetas).map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
        </select>
        {cargando && <span className="text-[0.8rem] text-ink-muted self-center">Cargando…</span>}
      </div>

      {!datos || datos.registros.length === 0 ? (
        <p className="text-[0.88rem] text-ink-muted py-6 text-center">
          No hay eventos para mostrar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.85rem] border-collapse">
            <thead>
              <tr className="text-left text-ink-muted border-b border-[var(--border)]">
                <th className="py-2 pr-3 font-medium">Cuándo</th>
                <th className="py-2 pr-3 font-medium">Evento</th>
                <th className="py-2 pr-3 font-medium">Cuenta</th>
                <th className="py-2 pr-3 font-medium">Desde</th>
                <th className="py-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {datos.registros.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]/50 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-muted">
                    {formatoFecha(r.creado_en)}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-block border rounded-control px-2 py-0.5 text-[0.76rem] font-medium whitespace-nowrap ${
                        TONO[r.tipo_evento] ?? "bg-neutral-200 text-ink-muted border-[var(--border)]"
                      }`}
                    >
                      {datos.etiquetas[r.tipo_evento] ?? r.tipo_evento}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="text-ink truncate max-w-[220px]">
                      {r.nombre_usuario ?? r.correo ?? "—"}
                    </div>
                    {r.nombre_usuario && r.correo && (
                      <div className="text-[0.76rem] text-ink-muted truncate max-w-[220px]">
                        {r.correo}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-muted font-mono text-[0.8rem]">
                    {r.ip ?? "—"}
                  </td>
                  <td className="py-2 text-ink-muted">{resumirDetalle(r.tipo_evento, r.detalle)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datos && totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-[0.83rem] text-ink-muted">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            className="rounded-control border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            className="rounded-control border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}