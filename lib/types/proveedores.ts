export type Proveedor = {
  id_proveedor: number;
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string | null;
  telefono: string | null;
  estado_proveedor: boolean;
};

export type ProveedorForm = {
  nombre_proveedor: string;
  nit_proveedor: string;
  correo_contacto: string;
  telefono: string;
};
