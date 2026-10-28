"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { PaginationBar } from "@/components/pagination/PaginationBar";
import { DataTable } from "@/components/list/DataTable";
import type { DataTableColumn } from "@/components/list/DataTable";

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
  const [okMsg, setOkMsg] = useState<string | null>(null);
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
    setOkMsg(null);
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
      setOkMsg(`Pedido #${idOrden} actualizado a ${ESTADOS_LABEL[nuevoEstado] || nuevoEstado}`);
      await cargarOrdenes();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  if (!usuario) return <p className="p-4 text-ink-muted">Cargando...</p>;

  const columns: DataTableColumn[] = [
    { key: "id_orden", header: "#", thClassName: "text-center", tdClassName: "text-center" },
    {
      key: "id_venta",
      header: "Venta",
      render: (row) => (row.id_venta ? `#${row.id_venta}` : "—"),
    },
    {
      key: "fecha_orden",
      header: "Fecha",
      render: (row) =>
        new Date(row.fecha_orden as string).toLocaleString("es-GT", {
          dateStyle: "short",
          timeStyle: "short",
        }),
    },
    {
      key: "nombre_cliente",
      header: "Cliente",
      render: (row) => {
        const o = row as unknown as OrdenListada;
        return (
          <div>
            <div className="font-medium">{o.nombre_cliente}</div>
            {o.notas && <div className="text-[0.78rem] text-ink-muted">{o.notas}</div>}
          </div>
        );
      },
    },
    {
      key: "estado",
      header: "Estado",
      render: (row) => {
        const estado = row.estado as string;
        return (
          <span
            className="inline-block px-[0.6rem] py-[0.2rem] rounded-md text-[0.78rem] font-semibold text-white"
            style={{ background: ESTADOS_COLOR[estado] || "#666" }}
          >
            {ESTADOS_LABEL[estado] || estado}
          </span>
        );
      },
    },
    {
      key: "total",
      header: "Total",
      tdClassName: "text-right",
      render: (row) => (
        <span className="font-semibold">Q{Number(row.total).toFixed(2)}</span>
      ),
    },
    {
      key: "productos",
      header: "Productos",
      render: (row) => {
        const o = row as unknown as OrdenListada;
        return (o.productos || []).map((pr) => (
          <div key={pr.id_detalle} className="mb-[0.35rem]">
            <span>{pr.codigo_producto}</span> × {Number(pr.cantidad).toFixed(3)}
            {pr.nombre_presentacion && pr.cantidad_presentacion && (
              <span className="text-ink-muted text-[0.75rem]">
                {" "}
                ({Number(pr.cantidad_presentacion).toFixed(0)} × {pr.nombre_presentacion})
              </span>
            )}
            <div className="text-[0.75rem] text-ink-muted mt-[0.1rem]">
              {pr.nombre_bodega ? (
                <>
                  Sacar de: <strong className="text-accent">{pr.nombre_bodega}</strong>
                </>
              ) : (
                <span className="text-danger">Sin bodega con stock registrado</span>
              )}
            </div>
          </div>
        ));
      },
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (row) => {
        const o = row as unknown as OrdenListada;
        return (ACCIONES_DISPONIBLES[o.estado] || [])
          .filter((acc) => !(acc.siguiente === "CANCELADO" && o.id_venta))
          .map((acc) => (
            <button
              key={acc.siguiente}
              type="button"
              onClick={() => cambiarEstado(o.id_orden, acc.siguiente)}
              className={`inline-block px-[0.6rem] py-[0.3rem] mr-[0.4rem] mb-[0.3rem] rounded-md bg-transparent font-medium text-[0.78rem] cursor-pointer ${
                acc.siguiente === "CANCELADO"
                  ? "border border-danger text-danger"
                  : "border border-accent text-accent"
              }`}
            >
              {acc.label}
            </button>
          ));
      },
    },
  ];

  return (
    <StaffShell usuario={usuario} title="Pedidos de entrega" subtitle="Seguimiento de las ventas con entrega a domicilio">
      <div className="min-h-0 flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row items-center gap-4">
          <h1 className="text-2xl font-bold text-ink">Pedidos de entrega</h1>
          <p className="text-ink-muted text-sm">Seguimiento de las ventas con entrega a domicilio</p>
        </header>

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line px-4 py-[0.8rem]">
          <span className="flex-1 min-w-[240px] text-[0.88rem] text-ink-muted">
            Los pedidos se generan solos al registrar una venta con entrega{" "}
            <strong>a domicilio</strong> en Ventas. Aquí se les da seguimiento hasta la entrega.
          </span>
          <Link
            href="/ventas"
            className="px-[1.2rem] py-[0.5rem] rounded-[10px] bg-accent text-white font-semibold no-underline"
          >
            Ir a Ventas
          </Link>
        </div>

        {error && <div className="text-danger font-semibold">{error}</div>}
        {okMsg && <div className="text-success font-semibold">{okMsg}</div>}

        <main className="flex-1">
          {loading ? (
            <p className="p-4 text-ink-muted text-[0.9rem]">Cargando…</p>
          ) : ordenes.length === 0 ? (
            <p className="p-6 text-center text-ink-muted">
              Aún no hay pedidos de entrega.
            </p>
          ) : (
            <DataTable
              rows={ordenes.map((o) => ({ ...o, key: o.id_orden.toString() }))}
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