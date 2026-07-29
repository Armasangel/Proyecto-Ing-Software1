import { AuthUsuario } from "@/lib/auth";

export const mockUsuarios: AuthUsuario[] = [
  { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" },
  { id_usuario: 2, nombre: "María López", correo: "maria@tienda.com", tipo_usuario: "EMPLEADO" },
];

export const mockCliente = {
  id_cliente: 1,
  nombre: "Carlos Ruiz",
  correo: "carlos@email.com",
  tipo_cliente: "MINORISTA",
};

export const mockClientes = [
  mockCliente,
  { id_cliente: 2, nombre: "Ana García", correo: "ana@email.com", tipo_cliente: "MAYORISTA" },
];

export const mockCategorias = [
  { id_categoria: 1, nombre_categoria: "Lácteos" },
  { id_categoria: 2, nombre_categoria: "Bebidas" },
];

export const mockMarcas = [
  { id_marca: 1, nombre_marca: "Marca A" },
  { id_marca: 2, nombre_marca: "Marca B" },
];

export const mockProducto = {
  id_producto: 1,
  codigo_producto: "PROD-001",
  nombre_producto: "Leche Entera",
  precio_unitario: 25.00,
  precio_mayoreo: 22.00,
  unidad_medida: "Litro",
  estado_producto: true,
  nombre_categoria: "Lácteos",
  nombre_marca: "Marca A",
};

export const mockProductos = [
  mockProducto,
  {
    id_producto: 2,
    codigo_producto: "PROD-002",
    nombre_producto: "Refresco Cola",
    precio_unitario: 15.00,
    precio_mayoreo: 12.00,
    unidad_medida: "Botella",
    estado_producto: true,
    nombre_categoria: "Bebidas",
    nombre_marca: "Marca B",
  },
];

export const mockBodegas = [
  { id_bodega: 1, nombre_bodega: "Bodega Central", ubicacion: "Zona 1", total_productos: 2, stock_total: 150 },
  { id_bodega: 2, nombre_bodega: "Bodega Norte", ubicacion: "Zona 2", total_productos: 1, stock_total: 30 },
];

export const mockProveedores = [
  {
    id_proveedor: 1,
    nombre_proveedor: "Proveedor X",
    nit_proveedor: "NIT-001",
    correo_contacto: "contacto@proveedorx.com",
    telefono: "12345678",
    estado_proveedor: true,
  },
];

export const mockDetalleVenta = {
  id_detalle: 1,
  id_venta: 1,
  codigo_producto: "PROD-001",
  nombre_producto: "Leche Entera",
  id_producto: 1,
  cantidad: 2,
  precio_unitario_venta: 25.00,
  subtotal: 50.00,
};

export const mockVenta = {
  id_venta: 1,
  id_cliente: 1,
  id_empleado: 2,
  fecha_venta: "2026-07-28T10:00:00.000Z",
  estado_venta: "CONFIRMADO",
  tipo_venta: "MINORISTA",
  tipo_entrega: "EN_TIENDA",
  direccion_entrega: null,
  total: 50.00,
  fecha_limite_pago: null,
  nombre_cliente: "Carlos Ruiz",
  correo_cliente: "carlos@email.com",
  nombre_colaborador: "María López",
  productos: [mockDetalleVenta],
};

export const mockVentas = [mockVenta];

export const mockDeuda = {
  id_deuda: 1,
  nombre_deudor: "Pedro Díaz",
  telefono_deudor: "87654321",
  fecha_inicio: "2026-07-01",
  monto_total: 100.00,
  estado_deuda: "PENDIENTE",
  fecha_creacion: "2026-07-01T10:00:00.000Z",
  id_usuario: 2,
  productos: [
    {
      id_producto: 1,
      nombre_producto: "Leche Entera",
      cantidad: 4,
      precio_unitario: 25.00,
      subtotal: 100.00,
    },
  ],
};

export const mockOrden = {
  id_orden: 1,
  id_cliente: 2,
  id_usuario: 1,
  fecha_orden: "2026-07-28T10:00:00.000Z",
  estado: "PENDIENTE",
  notas: "Entrega urgente",
  total: 30.00,
  nombre_cliente: "Ana García",
  correo_cliente: "ana@email.com",
  tipo_cliente: "MAYORISTA",
  nombre_usuario: "Juan Pérez",
  productos: [
    {
      id_detalle: 1,
      id_orden: 1,
      id_producto: 2,
      id_bodega: 1,
      codigo_producto: "PROD-002",
      nombre_producto: "Refresco Cola",
      cantidad: 2,
      precio_unitario: 15.00,
      subtotal: 30.00,
    },
  ],
};

export const mockStats = {
  productos: 2,
  ventas: 1,
  pendientes: 0,
  proveedores: 1,
};

export const mockDashboardStats = {
  stats: mockStats,
};

export const mockStockMinimoAlertas = [
  {
    id_bodega: 1,
    nombre_bodega: "Bodega Central",
    id_producto: 1,
    codigo_producto: "PROD-001",
    nombre_producto: "Leche Entera",
    unidad_medida: "Litro",
    cantidad_disponible: 3,
    stock_minimo: 10,
    diferencia: -7,
    ultima_actualizacion: "2026-07-28T10:00:00.000Z",
  },
];

export const mockGestionInventarioItem = {
  id_bodega: 1,
  nombre_bodega: "Bodega Central",
  ubicacion: "Zona 1",
  id_producto: 1,
  codigo_producto: "PROD-001",
  nombre_producto: "Leche Entera",
  unidad_medida: "Litro",
  estado_producto: true,
  nombre_categoria: "Lácteos",
  nombre_marca: "Marca A",
  cantidad_disponible: 100,
  stock_minimo: 10,
  ultima_actualizacion: "2026-07-28T10:00:00.000Z",
  bajo_minimo: false,
};
