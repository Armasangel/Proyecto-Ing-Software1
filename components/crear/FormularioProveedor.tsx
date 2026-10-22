"use client";

import { useState } from "react";
import { Campo, Mensaje, enviarJson, inputCls, primaryBtnCls } from "@/components/crear/ui";

const FORM_VACIO = {
  nombre_proveedor: "",
  nit_proveedor: "",
  correo_contacto: "",
  telefono: "",
};

export function FormularioProveedor() {
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!form.nombre_proveedor.trim() || !form.nit_proveedor.trim()) {
      setError("El nombre y el NIT del proveedor son obligatorios");
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/proveedores", {
        nombre_proveedor: form.nombre_proveedor.trim(),
        nit_proveedor: form.nit_proveedor.trim(),
        correo_contacto: form.correo_contacto.trim(),
        telefono: form.telefono.trim(),
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear el proveedor"));
        return;
      }
      setOk(`Proveedor «${form.nombre_proveedor.trim()}» creado.`);
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
        <Campo label="Nombre del proveedor" required>
          <input
            className={inputCls}
            value={form.nombre_proveedor}
            onChange={(e) => setForm((f) => ({ ...f, nombre_proveedor: e.target.value }))}
            placeholder="Distribuidora La Colonia"
          />
        </Campo>
        <Campo label="NIT" required>
          <input
            className={inputCls}
            value={form.nit_proveedor}
            onChange={(e) => setForm((f) => ({ ...f, nit_proveedor: e.target.value }))}
            placeholder="1234567-8"
          />
        </Campo>
        <Campo label="Correo de contacto">
          <input
            className={inputCls}
            type="email"
            value={form.correo_contacto}
            onChange={(e) => setForm((f) => ({ ...f, correo_contacto: e.target.value }))}
            placeholder="ventas@proveedor.com"
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
      </div>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando}>
          {guardando ? "Creando…" : "Crear proveedor"}
        </button>
      </div>
    </form>
  );
}
