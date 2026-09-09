"use client";

import { useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { matchesQuery, paginar, PaginationBar, type PageSize } from "@/lib/ui-table";

type Proveedor = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string | null;
  telefono: string | null;
  estado_proveedor: boolean;
};

const formVacio = {
  nombre_proveedor: "",
  nit_proveedor: "",
  correo_contacto: "",
  telefono: "",
};

const inputCls =
  "w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";

const inputClsToolbar =
  "px-3.5 py-2.5 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";

export default function ProveedoresPage() {
  const usuario = useStaffSession();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [mensaje, setMensaje] = useState("");

  // Búsqueda, filtros y paginación de la tabla
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

  async function cargar() {
    const res = await fetch("/api/proveedores");
    const data = await res.json();
    setProveedores(data.proveedores || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Al cambiar búsqueda o filtros, se vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [q, filtroEstado, perPage]);

  // Opciones de estado derivadas de los valores visibles en la tabla.
  const estadosDisponibles = useMemo(
    () => Array.from(new Set(proveedores.map((p) => p.estado_proveedor))),
    [proveedores]
  );

  const proveedoresFiltrados = useMemo(() => {
    return proveedores.filter((p) => {
      if (filtroEstado !== "" && p.estado_proveedor !== (filtroEstado === "true")) return false;
      return matchesQuery(q, p.nombre_proveedor, p.nit_proveedor, p.correo_contacto, p.telefono, p.id_proveedor);
    });
  }, [proveedores, q, filtroEstado]);

  const proveedoresPage = useMemo(
    () => paginar(proveedoresFiltrados, page, perPage),
    [proveedoresFiltrados, page, perPage]
  );

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  if (usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={usuario} title="Gestión de Proveedores" subtitle="">
        <p className="text-ink-muted">No tenés permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  async function guardar() {
    const res = await fetch("/api/proveedores", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id_proveedor: editando }),
    });
    if (res.ok) {
      setMensaje(editando ? "Proveedor actualizado." : "Proveedor creado.");
      setEditando(null);
      setCreando(false);
      setForm(formVacio);
      cargar();
    } else {
      setMensaje("Error al guardar.");
    }
  }

  async function desactivar(id_proveedor: number) {
    if (!confirm("¿Desactivar este proveedor?")) return;
    const res = await fetch("/api/proveedores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_proveedor }),
    });
    if (res.ok) {
      setMensaje("Proveedor desactivado.");
      cargar();
    }
  }

  function iniciarEdicion(p: Proveedor) {
    setEditando(p.id_proveedor);
    setCreando(false);
    setForm({
      nombre_proveedor: p.nombre_proveedor,
      nit_proveedor: p.nit_proveedor,
      correo_contacto: p.correo_contacto || "",
      telefono: p.telefono || "",
    });
  }

  return (
    <StaffShell
      usuario={usuario}
      title="Gestión de Proveedores"
      subtitle="Administrá los proveedores de la tienda"
    >
      {mensaje && (
        <p key={mensaje} className="text-market-600 mb-4 font-semibold animate-toast-in">
          {mensaje}
        </p>
      )}

      {!creando && !editando && (
        <button
          onClick={() => {
            setCreando(true);
            setForm(formVacio);
            setMensaje("");
          }}
          className="mb-6 px-5 py-2.5 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110"
        >
          + Nuevo proveedor
        </button>
      )}

      {(creando || editando) && (
        <div className="mb-6 p-5 border border-[var(--border)] bg-white rounded-card shadow-warm max-w-[480px]">
          <h3 className="mb-4 font-head text-base font-semibold text-ink">
            {editando ? "Editar proveedor" : "Nuevo proveedor"}
          </h3>
          {(
            [
              { label: "Nombre *", key: "nombre_proveedor" },
              { label: "NIT *", key: "nit_proveedor" },
              { label: "Correo", key: "correo_contacto" },
              { label: "Teléfono", key: "telefono" },
            ] as { label: string; key: keyof typeof formVacio }[]
          ).map(({ label, key }) => (
            <div key={key} className="mb-3">
              <label className="block mb-1 text-[0.85rem] text-ink-muted">{label}</label>
              <input
                className={inputCls}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex gap-2 mt-4">
            <button
              onClick={guardar}
              className="px-4 py-2 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setCreando(false);
              }}
              className="px-4 py-2 rounded-control bg-cream-100 border border-[var(--border)] text-ink-muted text-sm hover:bg-[var(--border)]/40"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, NIT, correo o teléfono…"
          aria-label="Buscar en proveedores"
          className={`${inputClsToolbar} flex-1 min-w-[220px]`}
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          aria-label="Filtrar por estado"
          className={inputClsToolbar}
        >
          <option value="">Todos los estados</option>
          {estadosDisponibles.map((s) => (
            <option key={String(s)} value={String(s)}>
              {s ? "Activos" : "Inactivos"}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
        <table className="w-full border-collapse text-[0.9rem]">
          <thead>
            <tr className="bg-market">
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Nombre</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">NIT</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Correo</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Teléfono</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado</th>
              <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedoresPage.slice.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3.5 py-8 text-center text-ink-muted">
                  {q.trim() || filtroEstado
                    ? "Ningún resultado para esa búsqueda o filtro."
                    : "No hay proveedores registrados."}
                </td>
              </tr>
            ) : (
              proveedoresPage.slice.map((p, i) => (
                <tr key={p.id_proveedor} className={i % 2 === 0 ? "bg-cream/40" : "bg-white"}>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink">{p.nombre_proveedor}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">{p.nit_proveedor}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">{p.correo_contacto || "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-ink-muted">{p.telefono || "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)]">
                    <span className={`font-semibold ${p.estado_proveedor ? "text-market-600" : "text-achiote-600"}`}>
                      {p.estado_proveedor ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 border-b border-[var(--border)] flex gap-2">
                    <button
                      onClick={() => iniciarEdicion(p)}
                      className="px-3 py-1.5 rounded-control bg-mango text-white border-none text-[0.82rem] font-medium transition-transform active:scale-[0.97] hover:brightness-110"
                    >
                      Editar
                    </button>
                    {p.estado_proveedor && (
                      <button
                        onClick={() => desactivar(p.id_proveedor)}
                        className="px-3 py-1.5 rounded-control bg-achiote text-white border-none text-[0.82rem] font-medium transition-transform active:scale-[0.97] hover:brightness-110"
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationBar
          total={proveedoresPage.total}
          page={proveedoresPage.paginaSegura}
          perPage={perPage}
          onPage={setPage}
          onPerPage={setPerPage}
          noun="proveedores"
        />
      </div>
    </StaffShell>
  );
}
