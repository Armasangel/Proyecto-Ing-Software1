"use client";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { RecepcionEntrada } from "@/components/compras/RecepcionEntrada";

export default function EntradaPage() {
  const usuario=useStaffSession();
  if(!usuario)return <p>Cargando…</p>;
  return <StaffShell usuario={usuario} title="Entrada de productos" subtitle="Conteo y recepción en bodega"><RecepcionEntrada /></StaffShell>;
}
