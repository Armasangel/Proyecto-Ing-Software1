"use client";

import { useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import {
  useDeudores,
  useInvalidateCobranza,
} from "@/hooks/useCobranza";
import type { DeudoresFilters, DeudoresSort } from "@/lib/cobranza/deudores-query";
import { DeudasFilters } from "@/components/cobranza/DeudasFilters";
import { DeudasTable } from "@/components/cobranza/DeudasTable";
import { PaymentForm, METODOS } from "@/components/cobranza/PaymentForm";
import type { Deudor } from "@/components/cobranza/types";
import { formatQuetzales } from "@/components/cobranza/format";

const DEFAULT_FILTERS: DeudoresFilters = {
  page: 1,
  limit: 50,
  sort: "fecha_limite_pago",
  order: "asc",
};

export default function CobranzaPage() {
  const usuario = useStaffSession();
  const invalidate = useInvalidateCobranza();
  const [filters, setFilters] = useState<DeudoresFilters>(DEFAULT_FILTERS);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Deudor | null>(null);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]>("EFECTIVO");
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, isFetching, refetch, error: queryError } = useDeudores(
    filters,
    !!usuario
  );

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!ventaSeleccionada) return;

    setGuardando(true);
    setMensaje("");
    setError("");

    const res = await fetch("/api/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_venta: ventaSeleccionada.id_venta,
        monto: Number(monto),
        metodo,
      }),
    });

    const body = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(body.error || "No se pudo registrar el pago");
      return;
    }

    setMensaje(
      body.deuda_pendiente <= 0
        ? "Pago registrado. Deuda saldada."
        : `Pago registrado. Saldo pendiente: Q${formatQuetzales(body.deuda_pendiente)}`
    );
    setVentaSeleccionada(null);
    setMonto("");
    invalidate();
  }

  function abrirPago(d: Deudor) {
    setVentaSeleccionada(d);
    setMonto(String(Number(d.deuda_pendiente)));
    setMetodo("EFECTIVO");
    setMensaje("");
    setError("");
  }

  function toggleSort(column: DeudoresSort) {
    setFilters((prev) => {
      const same = prev.sort === column;
      const order = same && prev.order === "asc" ? "desc" : "asc";
      return { ...prev, sort: column, order, page: 1 };
    });
  }

  if (!usuario) {
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  const deudores = data?.deudores ?? [];
  const pagination = data?.pagination;
  const loadError = error || (queryError instanceof Error ? queryError.message : "");

  return (
    <StaffShell
      usuario={usuario}
      title="Cobranza"
      subtitle="Deudas pendientes y registro de pagos"
    >
      {mensaje && (
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>
          {mensaje}
        </p>
      )}
      {loadError && (
        <p style={{ color: "#ff6b6b", marginBottom: "1rem", fontWeight: 600 }}>
          {loadError}
        </p>
      )}

      <DeudasFilters
        filters={filters}
        onChange={setFilters}
        onRefresh={() => refetch()}
        refreshing={isFetching}
      />

      {ventaSeleccionada && (
        <PaymentForm
          deudor={ventaSeleccionada}
          monto={monto}
          metodo={metodo}
          guardando={guardando}
          onMontoChange={setMonto}
          onMetodoChange={setMetodo}
          onSubmit={registrarPago}
          onCancel={() => setVentaSeleccionada(null)}
        />
      )}

      <DeudasTable
        deudores={deudores}
        cargando={isLoading}
        sort={filters.sort}
        order={filters.order}
        onSort={toggleSort}
        onPagar={abrirPago}
      />

      {pagination && pagination.total_pages > 1 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            marginTop: "1rem",
            fontSize: "0.85rem",
          }}
        >
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() =>
              setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
            }
            style={pageBtnStyle}
          >
            ← Anterior
          </button>
          <span style={{ color: "var(--muted)" }}>
            Página {pagination.page} de {pagination.total_pages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() =>
              setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
            }
            style={pageBtnStyle}
          >
            Siguiente →
          </button>
        </div>
      )}
    </StaffShell>
  );
}

const pageBtnStyle: React.CSSProperties = {
  padding: "0.35rem 0.7rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
  fontSize: "0.82rem",
};
