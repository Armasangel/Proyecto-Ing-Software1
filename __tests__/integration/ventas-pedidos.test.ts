/**
 * @jest-environment node
 */
// __tests__/integration/ventas-pedidos.test.ts
//
// Las órdenes ya no nacen solas: son el pedido de entrega de una VENTA a
// domicilio (que descuenta stock, factura y puede ser a crédito). También
// cubre las presentaciones de mayoreo en las líneas de venta.
// Requiere DATABASE_URL con el esquema al día (migración 08); si no, se salta.

import { Pool } from "pg";
import { POST as POST_VENTA, GET as GET_VENTAS } from "@/app/api/ventas/route";
import { POST as POST_ORDEN, GET as GET_ORDENES } from "@/app/api/ordenes/route";
import { PATCH as PATCH_ORDEN, DELETE as DELETE_ORDEN } from "@/app/api/ordenes/[id]/route";
import { POST as POST_ANULAR } from "@/app/api/ventas/[id]/anular/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("Ventas con pedido de entrega (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sufijo = `pedidos-${Date.now()}`;
  let idCategoria: number;
  let idMarca: number;
  let idProducto: number;
  let idBodega: number;
  let idPresentacion: number;
  let idCliente: number;

  const stock = async () =>
    Number((await pool.query(`SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega=$1 AND id_producto=$2`, [idBodega, idProducto])).rows[0].cantidad_disponible);

  const vender = (body: Record<string, unknown>, user = testUserEmpleado) =>
    POST_VENTA(
      createMockRequest("/api/ventas", {
        method: "POST",
        user,
        body: {
          id_cliente: idCliente,
          tipo_entrega: "EN_TIENDA",
          condicion_pago: "CONTADO",
          lineas: [{ id_producto: idProducto, id_bodega: idBodega, cantidad: 5, precio_unitario_venta: 10 }],
          ...body,
        },
      })
    );

  const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

  beforeAll(async () => {
    idCategoria = (await pool.query(`INSERT INTO categoria (nombre_categoria) VALUES ($1) RETURNING id_categoria`, [`Cat-${sufijo}`])).rows[0].id_categoria;
    idMarca = (await pool.query(`INSERT INTO marca (nombre_marca) VALUES ($1) RETURNING id_marca`, [`Marca-${sufijo}`])).rows[0].id_marca;
    idProducto = (
      await pool.query(
        `INSERT INTO producto (codigo_producto, nombre_producto, precio_unitario, unidad_medida, id_categoria, id_marca)
         VALUES ($1, $2, 10.00, 'unidad', $3, $4) RETURNING id_producto`,
        [`PROD-${sufijo}`, `Producto ${sufijo}`, idCategoria, idMarca]
      )
    ).rows[0].id_producto;
    idPresentacion = (
      await pool.query(`INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion) VALUES ($1, 'Caja de 24', 24) RETURNING id_presentacion`, [idProducto])
    ).rows[0].id_presentacion;
    idBodega = (await pool.query(`INSERT INTO bodega (nombre_bodega) VALUES ($1) RETURNING id_bodega`, [`Bodega-${sufijo}`])).rows[0].id_bodega;
    await pool.query(`INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo) VALUES ($1,$2,1000,0)`, [idBodega, idProducto]);
    idCliente = (await pool.query(`INSERT INTO cliente (nombre, correo) VALUES ($1,$2) RETURNING id_cliente`, [`Cliente ${sufijo}`, `c-${sufijo}@test.com`])).rows[0].id_cliente;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM detalle_orden WHERE id_orden IN (SELECT id_orden FROM orden WHERE id_cliente=$1)`, [idCliente]);
    await pool.query(`DELETE FROM orden WHERE id_cliente=$1`, [idCliente]);
    await pool.query(`DELETE FROM pago_deuda WHERE id_deuda IN (SELECT id_deuda FROM deuda WHERE id_cliente=$1)`, [idCliente]);
    await pool.query(`DELETE FROM deuda WHERE id_cliente=$1`, [idCliente]);
    await pool.query(`DELETE FROM factura WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente=$1)`, [idCliente]);
    await pool.query(`DELETE FROM detalle_venta WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente=$1)`, [idCliente]);
    await pool.query(`DELETE FROM venta WHERE id_cliente=$1`, [idCliente]);
    await pool.query(`DELETE FROM kardex WHERE id_bodega=$1`, [idBodega]);
    await pool.query(`DELETE FROM bodega_producto WHERE id_bodega=$1`, [idBodega]);
    await pool.query(`DELETE FROM cliente WHERE id_cliente=$1`, [idCliente]);
    await pool.query(`DELETE FROM bodega WHERE id_bodega=$1`, [idBodega]);
    await pool.query(`DELETE FROM presentacion_producto WHERE id_producto=$1`, [idProducto]);
    await pool.query(`DELETE FROM producto WHERE id_producto=$1`, [idProducto]);
    await pool.query(`DELETE FROM marca WHERE id_marca=$1`, [idMarca]);
    await pool.query(`DELETE FROM categoria WHERE id_categoria=$1`, [idCategoria]);
    await pool.end();
  });

  it("una venta en tienda no genera pedido", async () => {
    const res = await vender({ tipo_entrega: "EN_TIENDA" });
    expect(res.status).toBe(200);
    const { id_venta, id_orden } = await res.json();
    expect(id_orden).toBeUndefined();
    expect((await pool.query(`SELECT 1 FROM orden WHERE id_venta=$1`, [id_venta])).rowCount).toBe(0);
  });

  it("una venta a domicilio (el dueño también puede) genera su pedido CONFIRMADO con las mismas líneas", async () => {
    const stockAntes = await stock();
    const res = await vender({ tipo_entrega: "DOMICILIO", direccion_entrega: "Zona 1, Ciudad" }, testUserDueno);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id_orden).toBeGreaterThan(0);

    const orden = (await pool.query(`SELECT * FROM orden WHERE id_orden=$1`, [data.id_orden])).rows[0];
    expect(orden).toMatchObject({ id_venta: data.id_venta, estado: "CONFIRMADO", id_cliente: idCliente });
    expect(Number(orden.total)).toBe(50);
    expect(orden.notas).toContain("Zona 1, Ciudad");
    const det = (await pool.query(`SELECT * FROM detalle_orden WHERE id_orden=$1`, [data.id_orden])).rows;
    expect(det).toHaveLength(1);
    expect(det[0]).toMatchObject({ id_bodega: idBodega, id_producto: idProducto });
    expect(Number(det[0].cantidad)).toBe(5);
    expect(await stock()).toBe(stockAntes - 5); // el stock lo descuenta la venta, una sola vez

    // El listado de ventas muestra el estado del pedido.
    const lista = await (await GET_VENTAS(createMockRequest("/api/ventas", { user: testUserDueno }))).json();
    const fila = lista.ventas.find((v: { id_venta: number }) => v.id_venta === data.id_venta);
    expect(fila).toMatchObject({ id_orden: data.id_orden, estado_pedido: "CONFIRMADO" });
  });

  it("una venta a crédito con entrega genera factura, cuenta por cobrar Y pedido", async () => {
    const res = await vender({ tipo_entrega: "DOMICILIO", direccion_entrega: "Zona 5", condicion_pago: "CREDITO", credito: { plazo_dias: 30, numero_cuotas: 2 } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.credito.numero_factura).toMatch(/^FACT-/);
    expect(data.id_orden).toBeGreaterThan(0);
    expect((await pool.query(`SELECT 1 FROM deuda WHERE id_venta=$1`, [data.id_venta])).rowCount).toBe(1);
  });

  it("la presentación de mayoreo se convierte a unidad base (3 cajas de 24 = 72)", async () => {
    const stockAntes = await stock();
    const res = await vender({
      tipo_entrega: "DOMICILIO",
      direccion_entrega: "Bodega cliente",
      lineas: [{ id_producto: idProducto, id_bodega: idBodega, id_presentacion: idPresentacion, cantidad: 3, precio_unitario_venta: 10 }],
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(720); // 72 × Q10
    expect(await stock()).toBe(stockAntes - 72);
    const dv = (await pool.query(`SELECT cantidad FROM detalle_venta WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(Number(dv.cantidad)).toBe(72);
    const dord = (await pool.query(`SELECT cantidad, id_presentacion, cantidad_presentacion FROM detalle_orden WHERE id_orden=$1`, [data.id_orden])).rows[0];
    expect(Number(dord.cantidad)).toBe(72);
    expect(dord.id_presentacion).toBe(idPresentacion);
    expect(Number(dord.cantidad_presentacion)).toBe(3);
  });

  it("rechaza una presentación que no es del producto", async () => {
    const res = await vender({
      lineas: [{ id_producto: idProducto, id_bodega: idBodega, id_presentacion: 999999, cantidad: 1, precio_unitario_venta: 10 }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Presentación inválida/);
  });

  it("POST /api/ordenes ya no crea órdenes sueltas", async () => {
    const res = await POST_ORDEN(createMockRequest("/api/ordenes", { method: "POST", user: testUserDueno, body: { id_cliente: idCliente, lineas: [] } }));
    expect(res.status).toBe(410);
    expect((await res.json()).error).toMatch(/desde Ventas/);
  });

  it("el pedido de una venta avanza por su flujo, pero no se cancela desde Órdenes", async () => {
    const { id_orden } = await (await vender({ tipo_entrega: "DOMICILIO", direccion_entrega: "Zona 9" })).json();

    const avanzar = (estado: string) =>
      PATCH_ORDEN(createMockRequest(`/api/ordenes/${id_orden}`, { method: "PATCH", user: testUserEmpleado, body: { estado } }), ctx(id_orden));
    expect((await avanzar("EN_PREPARACION")).status).toBe(200);
    expect((await avanzar("ENVIADO")).status).toBe(200);

    const cancelar = await avanzar("CANCELADO");
    expect(cancelar.status).toBe(400);
    expect((await cancelar.json()).error).toMatch(/deshaz la venta/);
    const borrar = await DELETE_ORDEN(createMockRequest(`/api/ordenes/${id_orden}`, { method: "DELETE", user: testUserEmpleado }), ctx(id_orden));
    expect(borrar.status).toBe(400);

    expect((await avanzar("ENTREGADO")).status).toBe(200);
    const lista = await (await GET_ORDENES(createMockRequest("/api/ordenes", { user: testUserEmpleado }))).json();
    expect(lista.ordenes.find((o: { id_orden: number }) => o.id_orden === id_orden)?.id_venta).toBeGreaterThan(0);
  });

  it("deshacer la venta cancela su pedido y devuelve el stock", async () => {
    const stockAntes = await stock();
    const { id_venta, id_orden } = await (await vender({ tipo_entrega: "DOMICILIO", direccion_entrega: "Zona 10" })).json();
    expect(await stock()).toBe(stockAntes - 5);

    const anular = await POST_ANULAR(createMockRequest(`/api/ventas/${id_venta}/anular`, { method: "POST", user: testUserEmpleado }), ctx(id_venta));
    expect(anular.status).toBe(200);
    expect(await stock()).toBe(stockAntes);
    expect((await pool.query(`SELECT estado FROM orden WHERE id_orden=$1`, [id_orden])).rows[0].estado).toBe("CANCELADO");
  });
});
