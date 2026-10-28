"use client";

import { useEffect, useState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { TIPOS_USUARIO, labelRol } from "@/lib/roles";
import { Campo, Mensaje, inputCls, primaryBtnCls } from "@/components/ui/form";
import { enviarJson } from "@/lib/http";

type Bodega = { id_bodega: number; nombre_bodega: string };

const ROLES_CREABLES = [TIPOS_USUARIO.EMPLEADO, TIPOS_USUARIO.BODEGUERO];

const FORM_VACIO = {
  nombre: "",
  correo: "",
  contrasena: "",
  telefono: "",
  tipo_usuario: TIPOS_USUARIO.EMPLEADO as string,
  id_bodega: "",
  requiere_2fa: true,
};

export function FormularioUsuario() {
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let activo = true;
    fetch("/api/bodegas/simple")
      .then((res) => res.json())
      .then((data) => {
        if (activo) setBodegas(Array.isArray(data.bodegas) ? data.bodegas : []);
      })
      .catch(() => {
        if (activo) setError("No se pudieron cargar las bodegas");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!form.nombre.trim() || !form.correo.trim() || !form.contrasena) {
      setError("Nombre, correo y contraseña son obligatorios");
      return;
    }
    if (form.tipo_usuario === TIPOS_USUARIO.BODEGUERO && !form.id_bodega) {
      setError("Un usuario bodeguero necesita una bodega asignada");
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/usuarios", {
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        contrasena: form.contrasena,
        telefono: form.telefono.trim(),
        tipo_usuario: form.tipo_usuario,
        id_bodega: form.tipo_usuario === TIPOS_USUARIO.BODEGUERO ? Number(form.id_bodega) : null,
        requiere_2fa: form.requiere_2fa,
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear el usuario"));
        return;
      }
      setOk(`Usuario «${form.nombre.trim()}» creado como ${labelRol(form.tipo_usuario)}.`);
      setForm({ ...FORM_VACIO });
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" required>
          <input
            className={inputCls}
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Nombre completo"
          />
        </Campo>
        <Campo label="Correo" required>
          <input
            className={inputCls}
            type="email"
            value={form.correo}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            placeholder="usuario@tienda.com"
          />
        </Campo>
        <Campo
          label="Contraseña"
          required
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
        >
          <input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            value={form.contrasena}
            onChange={(e) => setForm((f) => ({ ...f, contrasena: e.target.value }))}
          />
        </Campo>
        <Campo label="Teléfono">
          <input
            className={inputCls}
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            placeholder="5555-5555"
          />
        </Campo>
        <Campo label="Rol">
          <select
            className={inputCls}
            value={form.tipo_usuario}
            onChange={(e) => setForm((f) => ({ ...f, tipo_usuario: e.target.value }))}
          >
            {ROLES_CREABLES.map((rol) => (
              <option key={rol} value={rol}>
                {labelRol(rol)}
              </option>
            ))}
          </select>
        </Campo>
        {form.tipo_usuario === TIPOS_USUARIO.BODEGUERO && (
          <Campo label="Bodega asignada" required>
            <select
              className={inputCls}
              value={form.id_bodega}
              onChange={(e) => setForm((f) => ({ ...f, id_bodega: e.target.value }))}
              disabled={cargando}
            >
              <option value="">{cargando ? "Cargando…" : "Selecciona una bodega"}</option>
              {bodegas.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.nombre_bodega}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={form.requiere_2fa}
          onChange={(e) => setForm((f) => ({ ...f, requiere_2fa: e.target.checked }))}
        />
        Exigir código de verificación por correo (2FA) al iniciar sesión
      </label>
      <p className="text-[0.8rem] text-ink-muted">
        Para crear otro dueño usa el proceso de promoción con verificación por correo.
      </p>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando || cargando}>
          {guardando ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
