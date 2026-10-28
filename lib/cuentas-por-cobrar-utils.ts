import type { FiltroVencimiento } from "./types/cuentas-por-cobrar";

export function fechaCuota(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function diasRestantes(fecha: string | null): { texto: string; cls: string } {
  if (!fecha) return { texto: "Sin fecha límite", cls: "text-ink-muted" };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) return { texto: `Vencida hace ${Math.abs(dias)} día(s)`, cls: "text-danger" };
  if (dias === 0) return { texto: "Vence hoy", cls: "text-danger" };
  if (dias <= 3) return { texto: `Vence en ${dias} día(s)`, cls: "text-warning" };
  return { texto: `Vence en ${dias} día(s)`, cls: "text-ink-muted" };
}

export function diasRestantesNum(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fecha}T00:00:00`);
  return Math.round((limite.getTime() - hoy.getTime()) / 86400000);
}

export function cumpleFiltroVencimiento(fecha: string | null, filtro: FiltroVencimiento): boolean {
  if (filtro === "todas") return true;
  if (filtro === "sin_fecha") return !fecha;
  const dias = diasRestantesNum(fecha);
  if (dias === null) return false;
  if (filtro === "vencidas") return dias < 0;
  if (filtro === "proximas") return dias >= 0 && dias <= 3;
  return true;
}
