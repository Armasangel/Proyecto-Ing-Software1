"use client";

import { StaffShell } from "@/components/StaffShell";
import { useDescuentos } from "@/hooks/useDescuentos";
import { DescuentosToolbar } from "@/components/descuentos/DescuentosToolbar";
import { DescuentosForm } from "@/components/descuentos/DescuentosForm";
import { DescuentosLista } from "@/components/descuentos/DescuentosLista";
import { DescuentosAsignaciones } from "@/components/descuentos/DescuentosAsignaciones";

export default function DescuentosPage() {
  const h = useDescuentos();

  if (!h.usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  if (h.usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={h.usuario} title="Descuentos" subtitle="">
        <p className="text-ink-muted">No tienes permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  return (
    <StaffShell usuario={h.usuario} title="Descuentos" subtitle="Configura descuentos por porcentaje, cantidad o escala">
      {h.mensaje && <p className="text-market-600 mb-4 font-semibold">{h.mensaje}</p>}
      {h.error && <p className="text-achiote mb-4 font-semibold">{h.error}</p>}

      <DescuentosToolbar h={h} />
      <DescuentosForm h={h} />
      <DescuentosLista h={h} />
      <DescuentosAsignaciones h={h} />
    </StaffShell>
  );
}
