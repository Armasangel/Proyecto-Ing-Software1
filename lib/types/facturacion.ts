import type { TipoDocumento } from "@/lib/tipos-documento";

export type Venta = {
  id_venta: number;
  fecha_venta: string;
  total: number;
  estado_venta: string;
  nombre: string;
  correo: string;
  codigo_cliente?: string | null;
  nit_cliente?: string | null;
  id_factura: number | null;
  numero_factura: string | null;
  tipo_documento?: string | null;
  total_factura: number | null;
};

export type ProductoFactura = {
  id_detalle: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type FacturaDetalle = {
  id_venta: number;
  fecha_venta: string;
  total: number;
  estado_venta: string;
  nombre: string;
  correo: string;
  codigo_cliente?: string | null;
  id_factura: number;
  numero_factura: string;
  tipo_documento?: string | null;
  nombre_cliente: string;
  nit_cliente: string;
  direccion_cliente?: string | null;
  total_factura: number;
  productos: ProductoFactura[];
};
