"use client";

import { useState } from "react";
import { ETIQUETAS_TIPO_CLIENTE, TIPOS_CLIENTE } from "@/lib/tipos-cliente";
import { Campo, Mensaje, enviarJson, inputCls, primaryBtnCls } from "@/components/crear/ui";

const FORM_VACIO = {
  nombre: "",
  correo: "",
  telefono: "",
  tipo_cliente: "MINORISTA",
  nit_cliente: "",
  codigo_cliente: "",
  limite_deuda: "",
  codigo_postal: "",
  direccion: "",
};

export function FormularioCliente() {
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const set = (campo: keyof typeof FORM_VACIO, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!form.nombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/clientes", {
        ...form,
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        telefono: form.telefono.trim(),
        nit_cliente: form.nit_cliente.trim(),
        codigo_cliente: form.codigo_cliente.trim(),
        limite_deuda: form.limite_deuda === "" ? null : Number(form.limite_deuda),
        codigo_postal: form.codigo_postal.trim(),
        direccion: form.direccion.trim(),
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear el cliente"));
        return;
      }
      setOk(`Cliente «${form.nombre.trim()}» creado.`);
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
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Nombre completo o razón social"
          />
        </Campo>
        <Campo label="Correo">
          <input
            className={inputCls}
            type="email"
            value={form.correo}
            onChange={(e) => set("correo", e.target.value)}
            placeholder="cliente@correo.com"
          />
        </Campo>
        <Campo label="Teléfono">
          <input
            className={inputCls}
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder="5555-5555"
          />
        </Campo>
        <Campo label="Tipo de cliente">
          <select
            className={inputCls}
            value={form.tipo_cliente}
            onChange={(e) => set("tipo_cliente", e.target.value)}
          >
            {TIPOS_CLIENTE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_TIPO_CLIENTE[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="NIT" hint="Se usa en la factura cambiaria. Sin NIT se guarda CF.">
          <input
            className={inputCls}
            value={form.nit_cliente}
            onChange={(e) => set("nit_cliente", e.target.value)}
            placeholder="1234567-8"
          />
        </Campo>
        <Campo label="Código de cliente" hint="Si se deja vacío se genera CLI-00001, CLI-00002…">
          <input
            className={inputCls}
            value={form.codigo_cliente}
            onChange={(e) => set("codigo_cliente", e.target.value)}
            placeholder="CLI-00001"
          />
        </Campo>
        <Campo label="Límite de crédito">
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            value={form.limite_deuda}
            onChange={(e) => set("limite_deuda", e.target.value)}
            placeholder="0.00"
          />
        </Campo>
        <Campo label="Código postal">
          <input
            className={inputCls}
            value={form.codigo_postal}
            onChange={(e) => set("codigo_postal", e.target.value)}
            placeholder="01001"
          />
        </Campo>
      </div>
      <Campo label="Dirección">
        <input
          className={inputCls}
          value={form.direccion}
          onChange={(e) => set("direccion", e.target.value)}
          placeholder="6a. avenida 12-34, zona 1"
        />
      </Campo>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando}>
          {guardando ? "Creando…" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
