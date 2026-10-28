import type { Pedido, TabKey } from "@/lib/types/bodega";

export const MOTIVO_LABEL: Record<string, string> = {
  MERMA: "Merma / daño",
  USO_INTERNO: "Uso interno",
  TRASLADO: "Traslado",
};

export const COLUMNAS_PEDIDOS: {
  estado: Pedido["estado"];
  titulo: string;
  siguiente?: { estado: string; label: string };
}[] = [
  { estado: "CONFIRMADO", titulo: "Nuevos", siguiente: { estado: "EN_PREPARACION", label: "Empezar a preparar" } },
  { estado: "EN_PREPARACION", titulo: "En preparación", siguiente: { estado: "ENVIADO", label: "Marcar enviado" } },
  { estado: "ENVIADO", titulo: "Enviados", siguiente: undefined },
];

export const PEDIDOS_POLL_MS = 6000;

export const TABS_BODEGA: { key: TabKey; label: string }[] = [
  { key: "pedidos", label: "Pedidos" },
  { key: "entrada", label: "Entrada" },
  { key: "salida", label: "Salida" },
  { key: "traslado", label: "Traslado" },
];
