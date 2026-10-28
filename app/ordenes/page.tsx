"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { PaginationBar } from "@/components/pagination/PaginationBar";
import { DataTable } from "@/components/list/DataTable";

type DetalleOrdenRow = {
  id_detalle: number;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  id_bodega: number | null;
  nombre_bodega: string | null;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  id_presentacion: number | null;
  nombre_presentacion: string | null;
  cantidad_presentacion: string | null;
};

type OrdenListada = {
  id_orden: number;
  id_cliente: number;
  id_usuario: number | null;
  id_venta: number | null;
  fecha_orden: string;
  estado: string;
  notas: string | null;
  total: string;
  nombre_cliente: string;
  correo_cliente: string;
  tipo_cliente: string;
  codigo_cliente?: string | null;
  nit_cliente?: string | null;
  direccion?: string | null;
  nombre_usuario: string | null;
  productos: DetalleOrdenRow[];
};

const ESTADOS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const ESTADOS_COLOR: Record<string, string> = {
  PENDIENTE: "#e67700",
  CONFIRMADO: "#1D24CA",
  EN_PREPARACION: "#7b2cbf",
  ENVIADO: "#0077b6",
  ENTREGADO: "#2d6a4f",
  CANCELADO: "#c1121f",
};

const ACCIONES_DISPONIBLES: Record<string, { siguiente: string; label: string }[]> = {
  PENDIENTE: [
    { siguiente: "CONFIRMADO", label: "Confirmar" },
    { siguiente: "CANCELADO", label: "Cancelar" },
  ],
  CONFIRMADO: [
    { siguiente: "EN_PREPARACION", label: "Preparar" },
    { siguiente: "CANCELADO", label: "Cancelar" },
  ],
  EN_PREPARACION: [
    { siguiente: "ENVIADO", label: "Enviar" },
    { siguiente: "CANCELADO", label: "Cancelar" },
  ],
  ENVIADO: [{ siguiente: "ENTREGADO", label: "Marcar entregado" }],
};

type Column = {
  key: string;
  header: string;
  thClassName?: string;
  tdClassName?: string;
};

export default function PedidosPage() {
  const usuario = useStaffSession();
  const [ordenes, setOrdenes] = useState<OrdenListada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const cargarOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/ordenes?page=${page}&limit=${perPage}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar los pedidos");
      setOrdenes(d.ordenes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    if (!usuario) return;
    cargarOrdenes();
  }, [usuario, cargarOrdenes]);

  async function cambiarEstado(idOrden: number, nuevoEstado: string) {
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${idOrden}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el pedido");
        return;
      }
      await cargarOrdenes();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  if (!usuario) return <p className="p-4 text-ink-muted">Cargando...</p>;

  const columns = [
    { key: "id_orden", header: "#", thClassName: "text-center", tdClassName: "text-center" },
    { key: "id_venta", header: "Venta", thClassName: "", tdClassName: "" },
    { key: "fecha_orden", header: "Fecha", tdClassName: "" },
    { key: "nombre_cliente", header: "Cliente", tdClassName: "" },
    { key: "estado", header: "Estado", tdClassName: "" },
    { key: "total", header: "Total", tdClassName: "text-right" },
    { key: "productos", header: "Productos", tdClassName: "" },
  ];

  return (
    <StaffShell usuario={usuario} title="Pedidos de entrega" subtitle="Seguimiento de las ventas con entrega a domicilio">
      <div className="min-h-0 flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row items-center gap-4">
          <h1 className="text-2xl font-bold text-ink">Pedidos de entrega</h1>
          <p className="text-ink-muted text-sm">Seguimiento de las ventas con entrega a domicilio</p>
        </header>

        <main className="flex-1">
          {loading ? (
            <p className="p-4 text-ink-muted text-[0.9rem]">Cargando…</p>
          ) : ordenes.length === 0 ? (
            <p className="p-6 text-center text-ink-muted">
              Aún no hay pedidos de entrega.
            </p>
          ) : (
            <DataTable
              rows={ordenes.map((o) => ({ key: o.id_orden.toString() } as { key: string }))}
              columns={columns}
            />
          )}
        </main>
      </div>

      <footer className="mt-6">
        <PaginationBar
          total={50}
          page={page}
          perPage={perPage}
          onPageChange={(p) => setPage(p)}
          onPerPageChange={(n) => setPerPage(n)}
          noun="pedidos"
        />
      </footer>
    </StaffShell>
  );
}