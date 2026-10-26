export type Producto = {
  id_producto: number;
  nombre_producto: string;
  codigo_producto: string;
  unidad_medida: string;
};

export type Presentacion = {
  id_presentacion: number;
  nombre_presentacion: string;
  factor_conversion: string;
};

export type BodegaSimple = { id_bodega: number; nombre_bodega: string };

export type Movimiento = {
  id_kardex: number;
  fecha_movimiento: string;
  tipo_movimiento: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: string;
  descripcion: string | null;
  motivo: string | null;
  nombre_producto: string;
  unidad_medida: string;
  nombre_presentacion: string | null;
  cantidad_presentacion: string | null;
};

export type TabKey = "pedidos" | "entrada" | "salida" | "traslado";

export type ProductoPedido = {
  id_detalle: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: string;
  unidad_medida: string;
  id_bodega: number | null;
  es_mi_bodega: boolean;
};

export type Pedido = {
  id_orden: number;
  fecha_orden: string;
  estado: "CONFIRMADO" | "EN_PREPARACION" | "ENVIADO";
  notas: string | null;
  total: string;
  nombre_cliente: string;
  codigo_cliente?: string | null;
  productos: ProductoPedido[];
};

export type MensajeBodega = { texto: string; tipo: "ok" | "err" };
