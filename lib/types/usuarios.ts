export type Usuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  tipo_usuario: string;
  estado_usuario: boolean;
  id_bodega: number | null;
  nombre_bodega: string | null;
  requiere_2fa: boolean;
};

export type CupoTipo = {
  tipo_usuario: string;
  limite: number | null;
  activos: number;
};

export type CuposDueno = {
  usados: number;
  maximo: number | null;
  disponibles: number | null;
};

export type BodegaSimple = {
  id_bodega: number;
  nombre_bodega: string;
};

export type NuevoUsuarioForm = {
  nombre: string;
  correo: string;
  telefono: string;
  contrasena: string;
  tipo_usuario: string;
  id_bodega: string;
  requiere_2fa: boolean;
};

export type Toast = {
  msg: string;
  tipo: "ok" | "err";
};
