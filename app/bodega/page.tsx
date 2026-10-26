"use client";

import { useBodega } from "@/hooks/useBodega";
import { BodegaHeader } from "@/components/bodega/BodegaHeader";
import { BodegaTabs } from "@/components/bodega/BodegaTabs";
import { BodegaPedidosBoard } from "@/components/bodega/BodegaPedidosBoard";
import { BodegaMovimientoForm } from "@/components/bodega/BodegaMovimientoForm";
import { BodegaHistorial } from "@/components/bodega/BodegaHistorial";
import { s } from "@/lib/styles/bodega";

export default function BodegaPage() {
  const h = useBodega();

  if (!h.usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <div style={s.page}>
      <BodegaHeader h={h} />

      <main style={h.tab === "pedidos" ? s.mainAncho : s.main}>
        <BodegaTabs h={h} />

        {h.tab === "pedidos" && <BodegaPedidosBoard h={h} />}

        {h.tab !== "pedidos" && <BodegaMovimientoForm h={h} />}

        {h.tab !== "pedidos" && <BodegaHistorial h={h} />}
      </main>
    </div>
  );
}
