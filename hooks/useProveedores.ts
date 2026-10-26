"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { matchesQuery, paginar, type PageSize } from "@/lib/ui-table";
import { FORM_VACIO_PROVEEDOR } from "@/lib/constants/proveedores";
import type { Proveedor, ProveedorForm } from "@/lib/types/proveedores";
import { useStaffSession } from "@/hooks/useStaffSession";

export function useProveedores() {
  const usuario = useStaffSession();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState<ProveedorForm>(FORM_VACIO_PROVEEDOR);
  const [mensaje, setMensaje] = useState("");

  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/proveedores");
    const data = await res.json();
    setProveedores(data.proveedores || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    setPage(1);
  }, [q, filtroEstado, perPage]);

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

  const proveedoresPage = useMemo(() => paginar(proveedoresFiltrados, page, perPage), [proveedoresFiltrados, page, perPage]);

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
      setForm(FORM_VACIO_PROVEEDOR);
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

  function abrirNuevo() {
    setCreando(true);
    setEditando(null);
    setForm(FORM_VACIO_PROVEEDOR);
    setMensaje("");
  }

  function cancelar() {
    setCreando(false);
    setEditando(null);
    setForm(FORM_VACIO_PROVEEDOR);
    setMensaje("");
  }

  return {
    usuario,
    proveedores,
    editando,
    setEditando,
    creando,
    setCreando,
    form,
    setForm,
    mensaje,
    setMensaje,
    q,
    setQ,
    filtroEstado,
    setFiltroEstado,
    page,
    setPage,
    perPage,
    setPerPage,
    estadosDisponibles,
    proveedoresFiltrados,
    proveedoresPage,
    cargar,
    guardar,
    desactivar,
    iniciarEdicion,
    abrirNuevo,
    cancelar,
  };
}
