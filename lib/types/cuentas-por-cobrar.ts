export type ProductoDeuda = {
  id_producto: number;
  nombre_producto: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

export type PagoDeuda = {
  id_pago: number;
  monto: string;
  fecha_pago: string;
  metodo_pago: string | null;
  nota: string | null;
  registrado_por: string | null;
};

export type CuotaCredito = {
  numero: number;
  fecha_vencimiento: string;
  monto: number;
  pagado: number;
  saldo: number;
  estado: "PAGADA" | "PARCIAL" | "PENDIENTE" | "VENCIDA";
};

export type Deuda = {
  id_deuda: number;
  nombre_deudor: string;
  telefono_deudor: string | null;
  fecha_inicio: string;
  fecha_limite_pago: string | null;
  monto_total: string;
  estado_deuda: "PENDIENTE" | "PAGADA";
  productos: ProductoDeuda[];
  id_cliente: number | null;
  limite_deuda: string | null;
  cliente_puede_comprar: boolean | null;
  total_pagado: string;
  saldo_pendiente: string;
  porcentaje_cubierto: string;
  pagos: PagoDeuda[];
  id_venta?: number | null;
  numero_factura?: string | null;
  plazo_dias?: number | null;
  numero_cuotas?: number;
  cuotas?: CuotaCredito[];
};

export type Cliente = {
  id_cliente: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  tipo_cliente: string;
  estado_cliente: boolean;
  limite_deuda: string | null;
  nit_cliente?: string | null;
  codigo_postal?: string | null;
  direccion?: string | null;
  codigo_cliente?: string | null;
};

export type Alerta = {
  id_cliente: number;
  deuda_pendiente: number;
  limite_deuda: number | null;
  bloqueado: boolean;
  cambioEstado: boolean;
};

export type FiltroVencimiento = "todas" | "vencidas" | "proximas" | "sin_fecha";
