import { rest } from "msw";
import {
  mockUsuarios,
  mockClientes,
  mockProductos,
  mockCategorias,
  mockMarcas,
  mockBodegas,
  mockProveedores,
  mockVentas,
  mockDeuda,
  mockOrden,
  mockStats,
  mockStockMinimoAlertas,
  mockGestionInventarioItem,
  mockDetalleVenta,
} from "./data";

function authGuard(req: { cookies: Record<string, string> }) {
  return !!req.cookies["auth_token"];
}

function duenoGuard(req: { cookies: Record<string, string> }) {
  return req.cookies["tipo_usuario"] === "DUENO";
}

function staffGuard(req: { cookies: Record<string, string> }) {
  const t = req.cookies["tipo_usuario"];
  return t === "DUENO" || t === "EMPLEADO";
}

export const handlers = [
  // ----- auth -----
  rest.post("/api/login", async (req, res, ctx) => {
    const { username, password } = await req.json();
    if (!username || !password) {
      return res(ctx.status(400), ctx.json({ error: "Usuario y contraseña son obligatorios" }));
    }
    const user = mockUsuarios.find((u) => u.correo.toLowerCase() === username.toLowerCase());
    if (!user || password !== "correcta") {
      return res(ctx.status(401), ctx.json({ error: "Credenciales incorrectas" }));
    }
    // Paso 1 completo: ya no se entrega el token acá, se simula el envío
    // del código de verificación (paso 2 lo resuelve /api/login/verificar-codigo).
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        requiere_verificacion: true,
        pre_token: "mock-pre-token-" + user.id_usuario,
        correo_enmascarado: user.correo.replace(/^(.{2}).+(@.+)$/, "$1***$2"),
      })
    );
  }),

  rest.post("/api/login/verificar-codigo", async (req, res, ctx) => {
    const { pre_token, codigo } = await req.json();
    if (!pre_token || !codigo) {
      return res(ctx.status(400), ctx.json({ error: "Faltan datos para verificar el código" }));
    }
    const idUsuario = Number(String(pre_token).replace("mock-pre-token-", ""));
    const user = mockUsuarios.find((u) => u.id_usuario === idUsuario);
    if (!user || codigo !== "123456") {
      return res(ctx.status(401), ctx.json({ error: "Código incorrecto" }));
    }
    return res(
      ctx.status(200),
      ctx.json({ ok: true, token: "mock-token-" + user.id_usuario, usuario: user })
    );
  }),

  rest.post("/api/logout", (_req, res, ctx) => {
    return res(ctx.json({ ok: true }));
  }),

  rest.get("/api/sesion", (req, res, ctx) => {
    if (!authGuard(req)) {
      return res(ctx.json({ usuario: null }));
    }
    const tipo = req.cookies["tipo_usuario"];
    const user =
      tipo === "DUENO"
        ? mockUsuarios[0]
        : tipo === "EMPLEADO"
          ? mockUsuarios[1]
          : null;
    return res(ctx.json({ usuario: user }));
  }),

  // ----- usuarios (dueno only) -----
  rest.get("/api/usuarios", (req, res, ctx) => {
    if (!duenoGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    const q = req.url.searchParams.get("q")?.toLowerCase();
    const tipo = req.url.searchParams.get("tipo");
    let list = mockUsuarios;
    if (q) list = list.filter((u) => u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q));
    if (tipo) list = list.filter((u) => u.tipo_usuario === tipo);
    return res(ctx.json({ usuarios: list }));
  }),

  // ----- clientes (staff) -----
  rest.get("/api/clientes", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ clientes: mockClientes }));
  }),

  // ----- productos (staff) -----
  rest.get("/api/productos", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ productos: mockProductos }));
  }),

  // ----- categorias (staff) -----
  rest.get("/api/categorias", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ categorias: mockCategorias }));
  }),

  // ----- marcas (staff) -----
  rest.get("/api/marcas", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ marcas: mockMarcas }));
  }),

  // ----- bodegas (staff GET, dueno POST) -----
  rest.get("/api/bodegas", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ bodegas: mockBodegas }));
  }),

  rest.post("/api/bodegas", async (req, res, ctx) => {
    if (!duenoGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    const body = await req.json();
    if (!body.nombre_bodega) {
      return res(ctx.status(400), ctx.json({ error: "Nombre de bodega requerido" }));
    }
    return res(ctx.status(201), ctx.json({ bodega: { id_bodega: 3, nombre_bodega: body.nombre_bodega, ubicacion: body.ubicacion || null } }));
  }),

  // ----- proveedores (dueno) -----
  rest.get("/api/proveedores", (req, res, ctx) => {
    if (!duenoGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ proveedores: mockProveedores }));
  }),

  // ----- ventas (staff) -----
  rest.get("/api/ventas", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    const page = Math.max(1, Number(req.url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.url.searchParams.get("limit")) || 50));
    return res(
      ctx.json({
        ventas: mockVentas,
        pagination: { total: mockVentas.length, page, limit, totalPages: Math.ceil(mockVentas.length / limit) },
      })
    );
  }),

  // ----- historial-ventas (dueno only) -----
  rest.get("/api/historial-ventas", (req, res, ctx) => {
    if (!duenoGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    const limit = Math.min(200, Math.max(1, Number(req.url.searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(req.url.searchParams.get("offset")) || 0);
    const filtered = [...mockVentas];
    const hasMore = false;
    return res(
      ctx.json({
        ventas: filtered,
        pagination: { limit, offset, hasMore, nextOffset: null, maxLimit: 200 },
      })
    );
  }),

  // ----- deudas (staff GET, dueno POST) -----
  rest.get("/api/deudas", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ deudas: [mockDeuda] }));
  }),

  // ----- ordenes (staff) -----
  rest.get("/api/ordenes", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    const page = Math.max(1, Number(req.url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.url.searchParams.get("limit")) || 50));
    return res(
      ctx.json({
        ordenes: [mockOrden],
        pagination: { total: 1, page, limit, totalPages: 1 },
      })
    );
  }),

  // ----- facturacion (staff) -----
  rest.get("/api/facturacion", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(
      ctx.json({
        ventas: mockVentas.map((v) => ({
          ...v,
          id_factura: 1,
          numero_factura: "FACT-001",
          total_factura: v.total,
        })),
      })
    );
  }),

  // ----- stats (staff) -----
  rest.get("/api/stats", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json(mockStats));
  }),

  // ----- gestion-inventario (dueno only) -----
  rest.get("/api/gestion-inventario", (req, res, ctx) => {
    if (!duenoGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(
      ctx.json({
        stock: [mockGestionInventarioItem],
        resumen: { filas: 1, bajo_minimo: 0 },
      })
    );
  }),

  rest.get("/api/gestion-inventario/stock-minimo", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ alertas: mockStockMinimoAlertas, total: mockStockMinimoAlertas.length }));
  }),

  // ----- precios (staff) -----
  rest.get("/api/precios", (req, res, ctx) => {
    if (!staffGuard(req)) return res(ctx.status(403), ctx.json({ error: "No autorizado" }));
    return res(ctx.json({ productos: mockProductos }));
  }),

  // ----- health (public) -----
  rest.get("/api/health", (_req, res, ctx) => {
    return res(
      ctx.json({
        status: "ok",
        mensaje: "Conexión a PostgreSQL exitosa ✅",
        base_de_datos: "test_db",
        hora_servidor: new Date().toISOString(),
      })
    );
  }),
];

export const authHandlers = {
  authenticatedAs: (tipo: "DUENO" | "EMPLEADO") =>
    handlers.map((h) => h),
};