export type Deudor = {
  id_venta: number;
  id_usuario: number;
  nombre_cliente: string;
  correo: string;
  fecha_venta: string;
  fecha_limite_pago: string | null;
  estado_venta: string;
  total_venta: string;
  total_pagado: string;
  deuda_pendiente: string;
  dias_atraso: number;
  estado_cobro: string;
};

export type DeudoresResponse = {
  deudores: Deudor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type DeudoresResumenResponse = {
  resumen: {
    deudas_activas: number;
    deudas_criticas: number;
    deudas_vencidas: number;
    total_adeudado: number;
  };
  por_cliente: {
    id_usuario: number;
    nombre_cliente: string;
    cantidad_deudas: number;
    total_adeudado: number;
  }[];
};
