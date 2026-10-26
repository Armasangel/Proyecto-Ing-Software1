export const OPCIONES_PAGOS = [1, 2, 3, 4, 6, 12] as const;
export const PLAZOS_RAPIDOS = [15, 30, 45, 60] as const;

export const ESTADOS_PEDIDO: Record<string, string> = {
  PENDIENTE: "pendiente",
  CONFIRMADO: "confirmado",
  EN_PREPARACION: "en preparación",
  ENVIADO: "enviado",
  ENTREGADO: "entregado",
  CANCELADO: "cancelado",
};

export const VENTANA_DESHACER_SEGUNDOS = 60;
