"use client";

import { StaffShell } from "@/components/StaffShell";
import { useSession } from "@/hooks/useSession";
import { ROLES_DUENO } from "@/lib/roles";
import { InventarioCatalogo } from "@/components/inventario-catalogo/InventarioCatalogo";

export default function InventarioPage() {
  const usuario = useSession({ roles: ROLES_DUENO });

  if (!usuario) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;

  return (
    <StaffShell usuario={usuario} title="Inventario y catálogo" subtitle="Productos, precios, stock, bodegas y movimientos">
      <InventarioCatalogo seccionInicial="stock" />
    </StaffShell>
  );
}