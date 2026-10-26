"use client";

import { useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { TIPOS_CLIENTE } from "@/lib/tipos-cliente";

type Tramo = {
  id_tramo?: number;
  cantidad_desde: number | string;
  porcentaje: number | string;
};

type Asignacion = {
  id_asignacion: number;
  id_descuento: number;
  id_cliente: number | null;
  tipo_cliente: string | null;
  nombre_cliente: string | null;
};

type Descuento = {
  id_descuento: number;
  nombre: string;
  tipo: "PORCENTAJE" | "CANTIDAD" | "ESCALA";
  activo: boolean;
  tramos: Tramo[];
  asignaciones: Asignacion[];
};

type Cliente = { id_cliente: number; nombre: string; tipo_cliente: string; codigo_cliente?: string | null };

const TIPOS: { valor: Descuento["tipo"]; etiqueta: string; ayuda: string }[] = [
  { valor: "PORCENTAJE", etiqueta: "Porcentaje", ayuda: "Un porcentaje fijo que aplica desde la primera unidad." },
  { valor: "CANTIDAD", etiqueta: "Por cantidad", ayuda: "Un porcentaje que aplica a partir de cierta cantidad de unidades." },
  { valor: "ESCALA", etiqueta: "Por escala", ayuda: "Varios tramos: a mayor cantidad, mayor porcentaje." },
];

const inputCls =
  "w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";
const inputSm =
  "px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";
const btnPrimary =
  "px-4 py-2 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110";
const btnGhost =
  "px-4 py-2 rounded-control bg-cream-100 border border-[var(--border)] text-ink-muted text-sm hover:bg-[var(--border)]/40";
const btnMini =
  "px-3 py-1.5 rounded-control border-none text-[0.82rem] font-medium transition-transform active:scale-[0.97] hover:brightness-110";

type FormState = {
  nombre: string;
  tipo: Descuento["tipo"];
  tramos: Tramo[];
};

const formVacio: FormState = {
  nombre: "",
  tipo: "PORCENTAJE",
  tramos: [{ cantidad_desde: 0, porcentaje: "" }],
};

export default function DescuentosPage() {
  const usuario = useStaffSession();
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [asignando, setAsignando] = useState<number | null>(null);

  async function cargar() {
    const [resD, resC] = await Promise.all([fetch("/api/descuentos"), fetch("/api/clientes")]);
    const dataD = await resD.json();
    const dataC = await resC.json();
    setDescuentos(dataD.descuentos || []);
    setClientes(dataC.clientes || []);
  }

  useEffect(() => {
    if (usuario && usuario.tipo_usuario === "DUENO") cargar();
  }, [usuario]);

  const formularioAbierto = creando || editando !== null;
  const tipoActual = useMemo(() => TIPOS.find((t) => t.valor === form.tipo), [form.tipo]);

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  if (usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={usuario} title="Descuentos" subtitle="">
        <p className="text-ink-muted">No tienes permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  function abrirNuevo() {
    setCreando(true);
    setEditando(null);
    setForm(formVacio);
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
    setError("");
  }

  function setTramo(i: number, patch: Partial<Tramo>) {
    setForm((f) => ({ ...f, tramos: f.tramos.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));
  }

  function agregarTramo() {
    setForm((f) => ({ ...f, tramos: [...f.tramos, { cantidad_desde: "", porcentaje: "" }] }));
  }

  function quitarTramo(i: number) {
    setForm((f) => ({ ...f, tramos: f.tramos.filter((_, k) => k !== i) }));
  }

  async function guardar() {
    setError("");
    const tramos = form.tramos.map((t) => ({
      cantidad_desde: Number(t.cantidad_desde),
      porcentaje: Number(t.porcentaje),
    }));
    const res = await fetch(editando ? `/api/descuentos/${editando}` : "/api/descuentos", {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: form.nombre, tipo: form.tipo, tramos }),
    });
    if (res.ok) {
      setMensaje(editando ? "Descuento actualizado." : "Descuento creado.");
      cerrarFormulario();
      cargar();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar el descuento.");
    }
  }

  async function alternarActivo(d: Descuento) {
    const res = await fetch(`/api/descuentos/${d.id_descuento}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !d.activo }),
    });
    if (res.ok) {
      setMensaje(d.activo ? "Descuento desactivado." : "Descuento activado.");
      cargar();
    } else {
      setError("No se pudo cambiar el estado.");
    }
  }

  async function borrar(d: Descuento) {
    if (!confirm(`¿Borrar el descuento "${d.nombre}"? El historial de ventas no cambia.`)) return;
    const res = await fetch(`/api/descuentos/${d.id_descuento}`, { method: "DELETE" });
    if (res.ok) {
      setMensaje("Descuento borrado.");
      cargar();
    } else {
      setError("No se pudo borrar el descuento.");
    }
  }

  async function asignar(idDescuento: number, tipo: "cliente" | "tipo", valor: string) {
    if (!valor) return;
    const body = tipo === "cliente" ? { id_cliente: Number(valor) } : { tipo_cliente: valor };
    const res = await fetch(`/api/descuentos/${idDescuento}/asignaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMensaje("Asignación agregada.");
      cargar();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo asignar.");
    }
  }

  async function quitarAsignacion(idDescuento: number, idAsignacion: number) {
    const res = await fetch(`/api/descuentos/${idDescuento}/asignaciones?id_asignacion=${idAsignacion}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMensaje("Asignación quitada.");
      cargar();
    } else {
      setError("No se pudo quitar la asignación.");
    }
  }

  return (
    <StaffShell
      usuario={usuario}
      title="Descuentos"
      subtitle="Configura reglas de descuento y asígnalas a clientes o tipos de cliente"
    >
      {mensaje && (
        <p key={mensaje} className="text-market-600 mb-4 font-semibold animate-toast-in">
          {mensaje}
        </p>
      )}
      {error && (
        <p key={error} className="text-achiote-600 mb-4 font-semibold animate-toast-in">
          {error}
        </p>
      )}

      {!formularioAbierto && (
        <button onClick={abrirNuevo} className={`mb-6 ${btnPrimary}`}>
          + Nuevo descuento
        </button>
      )}

      {formularioAbierto && (
        <div className="mb-6 p-5 border border-[var(--border)] bg-white rounded-card shadow-warm max-w-[620px]">
          <h3 className="mb-4 font-head text-base font-semibold text-ink">
            {editando ? "Editar descuento" : "Nuevo descuento"}
          </h3>

          <div className="mb-3">
            <label className="block mb-1 text-[0.85rem] text-ink-muted">Nombre *</label>
            <input
              className={inputCls}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Mayoreo fin de mes"
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1 text-[0.85rem] text-ink-muted">Tipo *</label>
            <select
              className={inputCls}
              value={form.tipo}
              onChange={(e) => {
                const tipo = e.target.value as Descuento["tipo"];
                // Al cambiar de tipo se reajusta el primer tramo para que tenga
                // sentido (porcentaje desde 0, cantidad desde N, escala libre).
                if (tipo === "PORCENTAJE") setForm({ ...form, tipo, tramos: [{ cantidad_desde: 0, porcentaje: form.tramos[0]?.porcentaje ?? "" }] });
                else setForm({ ...form, tipo });
              }}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
            {tipoActual && <p className="mt-1 text-[0.78rem] text-ink-muted">{tipoActual.ayuda}</p>}
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[0.85rem] text-ink-muted">Tramos (cantidad desde → porcentaje)</label>
              {form.tipo !== "PORCENTAJE" && (
                <button onClick={agregarTramo} className="text-[0.8rem] text-market-600 font-semibold">
                  + Agregar tramo
                </button>
              )}
            </div>
            {form.tramos.map((t, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min={0}
                  className={inputSm}
                  value={t.cantidad_desde}
                  disabled={form.tipo === "PORCENTAJE"}
                  onChange={(e) => setTramo(i, { cantidad_desde: e.target.value })}
                  placeholder="Desde"
                  aria-label="Cantidad desde"
                />
                <span className="text-ink-muted text-sm">unidades →</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputSm}
                  value={t.porcentaje}
                  onChange={(e) => setTramo(i, { porcentaje: e.target.value })}
                  placeholder="%"
                  aria-label="Porcentaje"
                />
                <span className="text-ink-muted text-sm">%</span>
                {form.tipo !== "PORCENTAJE" && form.tramos.length > 1 && (
                  <button onClick={() => quitarTramo(i)} className="text-achiote-600 text-sm font-semibold">
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={guardar} className={btnPrimary}>
              Guardar
            </button>
            <button onClick={cerrarFormulario} className={btnGhost}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {descuentos.length === 0 ? (
          <p className="text-ink-muted">No hay descuentos configurados.</p>
        ) : (
          descuentos.map((d) => (
            <div key={d.id_descuento} className="p-5 border border-[var(--border)] bg-white rounded-card shadow-warm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-head text-base font-semibold text-ink">{d.nombre}</h3>
                    <span
                      className={`text-[0.72rem] font-semibold px-2 py-0.5 rounded-full ${
                        d.activo ? "bg-market/15 text-market-600" : "bg-achiote/15 text-achiote-600"
                      }`}
                    >
                      {d.activo ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-[0.72rem] text-ink-muted uppercase tracking-wide">{d.tipo}</span>
                  </div>
                  <p className="mt-1 text-[0.85rem] text-ink-muted">
                    {d.tramos
                      .map((t) => `${Number(t.cantidad_desde)}+ u. → ${Number(t.porcentaje)}%`)
                      .join("  ·  ")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => iniciarEdicion(d)} className={`${btnMini} bg-mango text-white`}>
                    Editar
                  </button>
                  <button onClick={() => alternarActivo(d)} className={`${btnMini} bg-cream-100 border border-[var(--border)] text-ink-muted`}>
                    {d.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => borrar(d)} className={`${btnMini} bg-achiote text-white`}>
                    Borrar
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.8rem] font-semibold text-ink-muted">Asignado a:</span>
                  <button
                    onClick={() => setAsignando(asignando === d.id_descuento ? null : d.id_descuento)}
                    className="text-[0.8rem] text-market-600 font-semibold"
                  >
                    {asignando === d.id_descuento ? "Cerrar" : "+ Asignar"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.asignaciones.length === 0 ? (
                    <span className="text-[0.82rem] text-ink-muted">Sin asignaciones (no aplica a nadie).</span>
                  ) : (
                    d.asignaciones.map((a) => (
                      <span
                        key={a.id_asignacion}
                        className="inline-flex items-center gap-1.5 text-[0.8rem] bg-cream-100 border border-[var(--border)] rounded-full px-2.5 py-1"
                      >
                        {a.tipo_cliente ? `Tipo: ${a.tipo_cliente}` : `Cliente: ${a.nombre_cliente ?? a.id_cliente}`}
                        <button
                          onClick={() => quitarAsignacion(d.id_descuento, a.id_asignacion)}
                          className="text-achiote-600 font-bold"
                          aria-label="Quitar asignación"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {asignando === d.id_descuento && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <select
                      className={inputSm}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) asignar(d.id_descuento, "tipo", e.target.value);
                      }}
                      aria-label="Asignar a tipo de cliente"
                    >
                      <option value="">Asignar a tipo de cliente…</option>
                      {TIPOS_CLIENTE.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      className={inputSm}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) asignar(d.id_descuento, "cliente", e.target.value);
                      }}
                      aria-label="Asignar a un cliente"
                    >
                      <option value="">Asignar a un cliente…</option>
                      {clientes.map((c) => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          {c.codigo_cliente ? `${c.codigo_cliente} · ` : ""}
                          {c.nombre} ({c.tipo_cliente})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </StaffShell>
  );
}
