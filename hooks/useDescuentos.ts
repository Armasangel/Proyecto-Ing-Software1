"use client";

import { useCallback, useEffect, useState } from "react";
import { useStaffSession } from "@/hooks/useStaffSession";
import { FORM_VACIO_DESCUENTO } from "@/lib/constants/descuentos";
import type { Asignacion, Cliente, Descuento, FormStateDescuento, Tramo } from "@/lib/types/descuentos";

export function useDescuentos() {
  const usuario = useStaffSession();
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState<FormStateDescuento>(FORM_VACIO_DESCUENTO);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [asignando, setAsignando] = useState<number | null>(null);
  const [asigSel, setAsigSel] = useState<{ id_cliente: string; tipo_cliente: string }>({ id_cliente: "", tipo_cliente: "" });

  const cargar = useCallback(async () => {
    const [resD, resC] = await Promise.all([fetch("/api/descuentos"), fetch("/api/clientes")]);
    const dataD = await resD.json();
    const dataC = await resC.json();
    setDescuentos(dataD.descuentos || []);
    setClientes(dataC.clientes || []);
  }, []);

  useEffect(() => {
    if (usuario && usuario.tipo_usuario === "DUENO") cargar();
  }, [usuario, cargar]);

  const formularioAbierto = creando || editando !== null;

  function abrirNuevo() {
    setCreando(true);
    setEditando(null);
    setForm(FORM_VACIO_DESCUENTO);
    setMensaje("");
    setError("");
  }

  function iniciarEdicion(d: Descuento) {
    setEditando(d.id_descuento);
    setCreando(false);
    setMensaje("");
    setError("");
    setForm({
      nombre: d.nombre,
      tipo: d.tipo,
      tramos: d.tramos.map((t) => ({ cantidad_desde: Number(t.cantidad_desde), porcentaje: Number(t.porcentaje) })),
    });
  }

  function cerrarFormulario() {
    setCreando(false);
    setEditando(null);
    setForm(FORM_VACIO_DESCUENTO);
    setError("");
  }

  function cambiarTipo(tipo: Descuento["tipo"]) {
    setForm((prev) => ({
      ...prev,
      tipo,
      tramos: tipo === "PORCENTAJE" ? [{ cantidad_desde: 0, porcentaje: prev.tramos[0]?.porcentaje ?? "" }] : [{ cantidad_desde: tipo === "ESCALA" ? 1 : 0, porcentaje: "" }],
    }));
  }

  function agregarTramo() {
    setForm((prev) => {
      if (prev.tipo === "PORCENTAJE") return prev;
      const ultimo = Number(prev.tramos[prev.tramos.length - 1]?.cantidad_desde || 0);
      return { ...prev, tramos: [...prev.tramos, { cantidad_desde: ultimo + 1, porcentaje: "" }] };
    });
  }

  function eliminarTramo(idx: number) {
    setForm((prev) => {
      if (prev.tipo === "PORCENTAJE") return prev;
      const tramos = prev.tramos.filter((_, i) => i !== idx);
      if (tramos.length === 0) return { ...prev, tramos: [{ cantidad_desde: 0, porcentaje: "" }] };
      return { ...prev, tramos };
    });
  }

  function actualizarTramo(idx: number, campo: keyof Tramo, valor: string) {
    setForm((prev) => {
      const tramos = prev.tramos.map((t, i) => (i === idx ? { ...t, [campo]: valor } : t));
      return { ...prev, tramos };
    });
  }

  async function guardar() {
    setMensaje("");
    setError("");
    try {
      const body: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        tramos: form.tramos.map((t) => ({
          cantidad_desde: Number(t.cantidad_desde),
          porcentaje: Number(t.porcentaje),
        })),
      };
      const res = await fetch(editando ? `/api/descuentos/${editando}` : "/api/descuentos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMensaje(editando ? "Descuento actualizado." : "Descuento creado.");
      cerrarFormulario();
      cargar();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function borrar(d: Descuento) {
    if (!confirm(`¿Borrar el descuento "${d.nombre}"? El historial de ventas no cambia.`)) return;
    setMensaje("");
    setError("");
    try {
      const res = await fetch(`/api/descuentos/${d.id_descuento}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo borrar el descuento.");
      setMensaje("Descuento borrado.");
      cargar();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleActivo(d: Descuento) {
    setMensaje("");
    setError("");
    try {
      const res = await fetch(`/api/descuentos/${d.id_descuento}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !d.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar estado");
      setMensaje(d.activo ? "Descuento desactivado." : "Descuento activado.");
      cargar();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function asignar() {
    if (asignando == null) return;
    setMensaje("");
    setError("");
    try {
      const body: Record<string, unknown> = {};
      if (asigSel.id_cliente) body.id_cliente = Number(asigSel.id_cliente);
      else if (asigSel.tipo_cliente) body.tipo_cliente = asigSel.tipo_cliente;
      else throw new Error("Selecciona un cliente o un tipo de cliente");
      const res = await fetch(`/api/descuentos/${asignando}/asignaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al asignar");
      setMensaje("Asignación guardada.");
      setAsignando(null);
      setAsigSel({ id_cliente: "", tipo_cliente: "" });
      cargar();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function quitarAsignacion(id_asignacion: number) {
    setMensaje("");
    setError("");
    const dueno = descuentos.find((d) => d.asignaciones.some((a) => a.id_asignacion === id_asignacion));
    if (!dueno) return;
    try {
      const res = await fetch(
        `/api/descuentos/${dueno.id_descuento}/asignaciones?id_asignacion=${id_asignacion}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al quitar asignación");
      setMensaje("Asignación eliminada.");
      cargar();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return {
    usuario,
    descuentos,
    clientes,
    editando,
    creando,
    form,
    setForm,
    mensaje,
    setMensaje,
    error,
    setError,
    asignando,
    setAsignando,
    asigSel,
    setAsigSel,
    formularioAbierto,
    cargar,
    abrirNuevo,
    iniciarEdicion,
    cerrarFormulario,
    cambiarTipo,
    agregarTramo,
    eliminarTramo,
    actualizarTramo,
    guardar,
    borrar,
    toggleActivo,
    asignar,
    quitarAsignacion,
  };
}
