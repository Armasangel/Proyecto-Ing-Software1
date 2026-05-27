import type { CSSProperties } from "react";

export function formatQuetzales(n: string | number) {
  return Number(n).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-GT");
}

export function badgeEstadoCobro(estado: string): CSSProperties {
  if (estado === "CRITICO") {
    return { background: "rgba(220,53,69,0.15)", color: "#ff6b6b" };
  }
  if (estado === "VENCIDO") {
    return { background: "rgba(255,193,7,0.15)", color: "#ffc107" };
  }
  return { background: "rgba(45,106,79,0.15)", color: "#52b788" };
}
