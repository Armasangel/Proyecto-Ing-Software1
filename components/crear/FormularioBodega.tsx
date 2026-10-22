"use client";

import { useState } from "react";
import { Campo, Mensaje, enviarJson, inputCls, primaryBtnCls } from "@/components/crear/ui";

const FORM_VACIO = { nombre_bodega: "", ubicacion: "" };

export function FormularioBodega() {
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!form.nombre_bodega.trim()) {
      setError("El nombre de la bodega es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/bodegas", {
        nombre_bodega: form.nombre_bodega.trim(),
        ubicacion: form.ubicacion.trim(),
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear la bodega"));
        return;
      }
      setOk(`Bodega «${form.nombre_bodega.trim()}» creada.`);
      setForm({ ...FORM_VACIO });
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4">
      <Campo label="Nombre de la bodega" required>
        <input
          className={inputCls}
          value={form.nombre_bodega}
          onChange={(e) => setForm((f) => ({ ...f, nombre_bodega: e.target.value }))}
          placeholder="Bodega central"
        />
      </Campo>
      <Campo label="Ubicación">
        <input
          className={inputCls}
          value={form.ubicacion}
          onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
          placeholder="Dirección o referencia"
        />
      </Campo>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando}>
          {guardando ? "Creando…" : "Crear bodega"}
        </button>
      </div>
    </form>
  );
}
