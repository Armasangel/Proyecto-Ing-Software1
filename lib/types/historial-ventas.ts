export type LineaHistorial = {
  codigo_producto: string | null;
  nombre_producto: string | null;
  id_producto: number;
  cantidad: string | number;
  subtotal: string | number;
};

export type VentaHistorial = {
  id_venta: number;
  fecha_venta: string;
  estado_venta: string;
  tipo_venta: string;
  tipo_entrega: string;
  enlinea: boolean;
  total: string | number;
  nombre_cliente: string;
  correo_cliente: string;
  codigo_cliente?: string | null;
  nombre_colaborador: string | null;
  productos: LineaHistorial[];
};

export type Pagination = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  maxLimit: number;
};

export type ProductoOpt = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
};

export type ClienteOpt = {
  id_cliente: number;
  nombre: string;
  correo: string | null;
  codigo_cliente?: string | null;
};

export type ProveedorOpt = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
};

export type PickerTipo = null | "producto" | "cliente" | "proveedor";
