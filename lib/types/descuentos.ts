export type Tramo = {
  id_tramo?: number;
  cantidad_desde: number | string;
  porcentaje: number | string;
};

export type Asignacion = {
  id_asignacion: number;
  id_descuento: number;
  id_cliente: number | null;
  tipo_cliente: string | null;
  nombre_cliente: string | null;
};

export type Descuento = {
  id_descuento: number;
  nombre: string;
  tipo: "PORCENTAJE" | "CANTIDAD" | "ESCALA";
  activo: boolean;
  tramos: Tramo[];
  asignaciones: Asignacion[];
};

export type Cliente = { id_cliente: number; nombre: string; tipo_cliente: string; codigo_cliente?: string | null };

export type FormStateDescuento = {
  nombre: string;
  tipo: Descuento["tipo"];
  tramos: Tramo[];
};
