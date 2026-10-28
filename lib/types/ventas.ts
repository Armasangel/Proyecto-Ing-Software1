export type Cliente = {
  id_cliente: number;
  nombre: string;
  correo: string | null;
  tipo_cliente: string;
  telefono?: string | null;
  limite_deuda?: string | null;
  total_ventas?: number;
  es_consumidor_final?: boolean;
  nit_cliente?: string | null;
  codigo_postal?: string | null;
  direccion?: string | null;
  codigo_cliente?: string | null;
};

export type Producto = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  estado_producto: boolean;
};

export type Bodega = { id_bodega: number; nombre_bodega: string };

export type StockRow = {
  id_bodega: number;
  id_producto: number;
  cantidad_disponible: string;
};

export type Presentacion = {
  id_presentacion: number;
  nombre_presentacion: string;
  factor_conversion: string;
};

export type LineaVenta = {
  key: string;
  id_producto: string;
  id_bodega: string;
  cantidad: string;
  id_presentacion: string;
  precio_unitario_venta: string;
};

export type ProductoVentaRow = {
  id_detalle: number;
  id_venta: number;
  codigo_producto: string;
  id_producto: number;
  cantidad: string;
  precio_unitario_venta: string;
  subtotal: string;
};

export type VentaListada = {
  id_venta: number;
  id_cliente: number;
  id_empleado: number | null;
  fecha_venta: string;
  estado_venta: string;
  tipo_venta: string;
  tipo_entrega: string;
  direccion_entrega: string | null;
  total: string;
  fecha_limite_pago: string | null;
  condicion_pago?: string;
  id_orden?: number | null;
  estado_pedido?: string | null;
  nombre_cliente: string;
  correo_cliente: string;
  codigo_cliente?: string | null;
  nombre_colaborador: string | null;
  productos: ProductoVentaRow[];
};

export type CondicionPago = "CONTADO" | "CREDITO";

export type CreditoGenerado = {
  numero_factura: string;
  tipo_documento?: string;
  fecha_limite_pago: string;
  bloqueado: boolean;
};

export type VentaDeshacer = { id: number; total: number };
