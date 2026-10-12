/**
 * Contratos de la API compartidos entre frontend y backend.
 *
 * Solo contiene TIPOS (nada de código ejecutable ni imports de servidor), así
 * que es seguro importarlo tanto desde componentes cliente como desde rutas
 * de `app/api/**` y `lib/*`:
 *
 *   - Rutas:   `NextResponse.json<DeudasListResponse>({ deudas })`
 *   - Cliente: `api.get<DeudasListResponse>("/api/deudas")`
 *
 * Así, si una ruta cambia la forma de su respuesta, TypeScript marca
 * también las pantallas que la consumen.
 *
 * Convención de valores: los campos NUMERIC de Postgres llegan como `string`
 * (así los devuelve `pg`); los contadores y totales calculados en el
 * servidor llegan como `number`.
 */

// ─── Errores ─────────────────────────────────────────────────────────────────

/** Cuerpo de toda respuesta de error de la API (ver `lib/api-error.ts`). */
export type ApiErrorBody = { error: string };

// ─── Deudas ──────────────────────────────────────────────────────────────────

export type EstadoDeuda = "PENDIENTE" | "PAGADA";
export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";

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

export type Deuda = {
  id_deuda: number;
  nombre_deudor: string;
  telefono_deudor: string | null;
  fecha_inicio: string;
  fecha_limite_pago: string | null;
  monto_total: string;
  estado_deuda: EstadoDeuda;
  productos: ProductoDeuda[];
  id_cliente: number | null;
  limite_deuda: string | null;
  cliente_puede_comprar: boolean | null;
  total_pagado: string;
  saldo_pendiente: string;
  porcentaje_cubierto: string;
  pagos: PagoDeuda[];
};

/** Resultado de recalcular el bloqueo de un cliente tras mover sus deudas. */
export type AlertaDeuda = {
  id_cliente: number;
  deuda_pendiente: number;
  limite_deuda: number | null;
  bloqueado: boolean;
  /** `true` si esta operación cambió el estado del cliente (bloqueó/desbloqueó). */
  cambioEstado: boolean;
};

// GET /api/deudas
export type DeudasListResponse = { deudas: Deuda[] };

// POST /api/deudas
export type CrearDeudaBody = {
  nombre_deudor: string;
  telefono_deudor?: string | null;
  fecha_inicio: string;
  fecha_limite_pago?: string | null;
  id_cliente?: number | null;
  /** Deuda con desglose por producto… */
  productos?: { id_producto: number; cantidad: number }[];
  /** …o deuda "de arrastre" sin productos (alternativa a `productos`). */
  monto_libre?: number;
};
export type CrearDeudaResponse = { deuda: Deuda; alerta: AlertaDeuda | null };

// PATCH /api/deudas/:id  (alterna PENDIENTE ⇄ PAGADA)
export type CambiarEstadoDeudaResponse = { deuda: Deuda; alerta: AlertaDeuda | null };

// POST /api/deudas/:id/pagos
export type RegistrarPagoBody = {
  monto: number;
  metodo_pago: MetodoPago;
  nota?: string | null;
};
export type PagoRegistrado = { id_pago: number; id_deuda: number; monto: string };
export type RegistrarPagoResponse = {
  pago: PagoRegistrado;
  saldo_pendiente: number;
  estado_deuda: EstadoDeuda;
  alerta: AlertaDeuda | null;
};

// ─── Clientes ────────────────────────────────────────────────────────────────

export type Cliente = {
  id_cliente: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  tipo_cliente: string;
  estado_cliente: boolean;
  limite_deuda: string | null;
};

// GET /api/clientes  (?todos=1 incluye también a los bloqueados)
export type ClientesListResponse = { clientes: Cliente[] };

// POST /api/clientes
export type CrearClienteBody = {
  nombre: string;
  telefono?: string;
  correo?: string;
  tipo_cliente: string;
  limite_deuda: number | null;
};
export type CrearClienteResponse = { cliente: Cliente };

// PATCH /api/clientes/:id
export type ActualizarLimiteBody = { limite_deuda: string | number | null };
export type ActualizarLimiteResponse = { alerta: AlertaDeuda | null };

// ─── Productos ───────────────────────────────────────────────────────────────

/** Campos de producto que consume la pantalla de deudas. */
export type ProductoListado = {
  id_producto: number;
  nombre_producto: string;
  precio_unitario: string;
  unidad_medida: string;
  estado_producto: boolean;
};

// GET /api/productos
export type ProductosListResponse = { productos: ProductoListado[] };

// ─── Notificaciones automáticas de deuda ─────────────────────────────────────

export type ConfigNotificacionDeuda = {
  activo: boolean;
  intervalo_dias: number;
  actualizado_en: string | null;
  actualizado_por: string | null;
};

// GET | PATCH /api/configuracion/notificaciones-deuda
export type NotificacionDeudaConfigResponse = { configuracion: ConfigNotificacionDeuda };
export type ActualizarNotificacionDeudaBody = Partial<
  Pick<ConfigNotificacionDeuda, "activo" | "intervalo_dias">
>;

// POST /api/configuracion/notificaciones-deuda/ejecutar-ahora
export type EjecutarNotificacionesResponse = {
  activo: boolean;
  procesados: number;
  enviados: number;
  fallidos: number;
};
