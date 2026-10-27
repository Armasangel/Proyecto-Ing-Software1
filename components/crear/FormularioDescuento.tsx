"use client";

import { useState } from "react";
import { ETIQUETAS_TIPO_CLIENTE, TIPOS_CLIENTE } from "@/lib/tipos-cliente";
import { TIPOS_DESCUENTO } from "@/lib/descuentos";
import { Campo, Mensaje, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/form";
import { enviarJson } from "@/lib/http";

type TramoForm = { cantidad_desde: string; porcentaje: string };

const TRAMO_VACIO: TramoForm = { cantidad_desde: "", porcentaje: "" };

export function FormularioDescuento() {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>("PORCENTAJE");
  const [tramos, setTramos] = useState<TramoForm[]>([{ ...TRAMO_VACIO }]);
  const [tipoCliente, setTipoCliente] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function actualizarTramo(indice: number, campo: keyof TramoForm, valor: string) {
    setTramos((filas) => filas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!nombre.trim()) {
      setError("El nombre del descuento es obligatorio");
      return;
    }
    const tramosLimpios = tramos
      .map((t) => ({
        cantidad_desde: Number(t.cantidad_desde),
        porcentaje: Number(t.porcentaje),
      }))
      .filter((t) => Number.isFinite(t.cantidad_desde) && Number.isFinite(t.porcentaje));

    if (tramosLimpios.length === 0) {
      setError("Agrega al menos un tramo con cantidad y porcentaje");
      return;
    }
    if (tramosLimpios.some((t) => t.cantidad_desde < 0 || t.porcentaje < 0 || t.porcentaje > 100)) {
      setError("La cantidad no puede ser negativa y el porcentaje debe estar entre 0 y 100");
      return;
    }
    if (new Set(tramosLimpios.map((t) => t.cantidad_desde)).size !== tramosLimpios.length) {
      setError("No puede haber dos tramos con la misma cantidad desde");
      return;
    }

    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson("/api/descuentos", {
        nombre: nombre.trim(),
        tipo,
        tramos: tramosLimpios,
        asignaciones: tipoCliente ? [{ tipo_cliente: tipoCliente }] : [],
      });
      if (!exito) {
        setError(String(data.error || "No se pudo crear el descuento"));
        return;
      }
      setOk(`Descuento «${nombre.trim()}» creado.`);
      setNombre("");
      setTipo("PORCENTAJE");
      setTramos([{ ...TRAMO_VACIO }]);
      setTipoCliente("");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre del descuento" required>
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Descuento por volumen"
          />
        </Campo>
        <Campo label="Tipo">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_DESCUENTO.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <fieldset className="rounded-control border border-[var(--border)] p-3">
        <legend className="px-1 text-[0.82rem] font-semibold text-ink-muted">Tramos</legend>
        <div className="grid gap-2">
          <div className="hidden gap-2 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-muted sm:grid sm:grid-cols-[1fr_1fr_auto]">
            <span>Cantidad desde</span>
            <span>Porcentaje</span>
            <span />
          </div>
          {tramos.map((tramo, indice) => (
            <div key={indice} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1"
                value={tramo.cantidad_desde}
                onChange={(e) => actualizarTramo(indice, "cantidad_desde", e.target.value)}
                placeholder="12"
                aria-label={`Cantidad desde del tramo ${indice + 1}`}
              />
              <input
                className={inputCls}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={tramo.porcentaje}
                onChange={(e) => actualizarTramo(indice, "porcentaje", e.target.value)}
                placeholder="10"
                aria-label={`Porcentaje del tramo ${indice + 1}`}
              />
              <button
                type="button"
                className={`${secondaryBtnCls} col-span-2 sm:col-span-1`}
                onClick={() => setTramos((filas) => filas.filter((_, i) => i !== indice))}
                disabled={tramos.length === 1}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={`${secondaryBtnCls} mt-2`}
          onClick={() => setTramos((filas) => [...filas, { ...TRAMO_VACIO }])}
        >
          + Agregar tramo
        </button>
      </fieldset>

      <Campo
        label="Asignar a tipo de cliente"
        hint="Opcional. Si no asignas ahora, la regla no se aplicará hasta que la asignes desde Descuentos."
      >
        <select className={inputCls} value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value)}>
          <option value="">Sin asignar</option>
          {TIPOS_CLIENTE.map((t) => (
            <option key={t} value={t}>
              {ETIQUETAS_TIPO_CLIENTE[t]}
            </option>
          ))}
        </select>
      </Campo>

      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando}>
          {guardando ? "Creando…" : "Crear descuento"}
        </button>
      </div>
    </form>
  );
}
