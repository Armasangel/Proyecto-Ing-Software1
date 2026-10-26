"use client";

import { useEffect, useMemo, useState } from "react";
import { useStaffSession } from "@/hooks/useStaffSession";
import { matchesQuery, paginar, type PageSize } from "@/lib/ui-table";
import { etiquetaTipoDocumento, type TipoDocumento } from "@/lib/tipos-documento";
import type { FacturaDetalle, Venta } from "@/lib/types/facturacion";

export function useFacturacion() {
  const usuario = useStaffSession();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");
  const [tipoDocumentoEmitir, setTipoDocumentoEmitir] = useState<Record<number, TipoDocumento>>({});
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFactura, setFiltroFactura] = useState("todas");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

  useEffect(() => {
    fetch("/api/facturacion")
      .then((r) => r.json())
      .then((d) => setVentas(d.ventas || []));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, filtroEstado, filtroFactura, perPage]);

  const estadosDisponibles = useMemo(
    () => Array.from(new Set(ventas.map((v) => v.estado_venta))).sort(),
    [ventas]
  );

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      if (filtroEstado && v.estado_venta !== filtroEstado) return false;
      if (filtroFactura === "facturadas" && !v.numero_factura) return false;
      if (filtroFactura === "sin_facturar" && v.numero_factura) return false;
      return matchesQuery(q, v.nombre, v.codigo_cliente, v.correo, v.numero_factura, v.id_venta);
    });
  }, [ventas, q, filtroEstado, filtroFactura]);

  const ventasPage = useMemo(() => paginar(ventasFiltradas, page, perPage), [ventasFiltradas, page, perPage]);

  async function cargarVentas() {
    const res = await fetch("/api/facturacion");
    const data = await res.json();
    setVentas(data.ventas || []);
  }

  async function emitirFactura(id_venta: number, tipo_documento: TipoDocumento) {
    setCargando(true);
    setMensaje("");
    const res = await fetch("/api/facturacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_venta, tipo_documento }),
    });
    const data = await res.json();
    if (res.ok) {
      setMensaje(
        `${etiquetaTipoDocumento(data.tipo_documento ?? tipo_documento)} ${data.numero_factura} emitida correctamente`
      );
      await cargarVentas();
    } else {
      setMensaje(data.error || "Error al emitir factura");
    }
    setCargando(false);
  }

  async function verFactura(id_venta: number) {
    setErrorDetalle("");
    setCargandoDetalle(true);
    try {
      const res = await fetch(`/api/facturacion/${id_venta}`);
      const data = await res.json();
      if (res.ok) {
        setFacturaDetalle(data.factura);
      } else {
        setErrorDetalle(data.error || "No se pudo cargar la factura");
      }
    } catch {
      setErrorDetalle("No se pudo cargar la factura");
    }
    setCargandoDetalle(false);
  }

  return {
    usuario,
    ventas,
    mensaje, setMensaje,
    cargando,
    facturaDetalle, setFacturaDetalle,
    cargandoDetalle,
    errorDetalle, setErrorDetalle,
    tipoDocumentoEmitir, setTipoDocumentoEmitir,
    q, setQ,
    filtroEstado, setFiltroEstado,
    filtroFactura, setFiltroFactura,
    page, setPage,
    perPage, setPerPage,
    estadosDisponibles,
    ventasFiltradas,
    ventasPage,
    emitirFactura,
    verFactura,
    cargarVentas,
  };
}

export type FacturacionController = ReturnType<typeof useFacturacion>;
