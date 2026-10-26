/**
 * @jest-environment node
 */
// __tests__/integration/descuentos-ventas.test.ts
//
// Flujo completo de descuentos contra Postgres REAL (migración 09):
// regla con tramos -> asignación a cliente/tipo -> venta que aplica el
// descuento por línea -> total neto propagado a venta, crédito, factura y
// deuda -> anulación consistente -> reportes que siguen cuadrando.
//
// Requiere DATABASE_URL con el esquema al día (init/01_schema.sql o la
// migración 09). Si no está definida, la suite se salta.

import { Pool } from "pg";
import { POST as POST_VENTA } from "@/app/api/ventas/route";
import { POST as POST_ANULAR } from "@/app/api/ventas/[id]/anular/route";
import { createMockRequest, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("Descuentos en ventas (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sufijo = `desc-${Date.now()}`;
  let idCategoria: number;
  let idMarca: number;
  let idProducto: number;
  let idBodega: number;
  let idCliente: number;
  let idClienteMayorista: number;
  let idRegla: number;

  const stock = async () =>
    Number(
      (await pool.query(`SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega=$1 AND id_producto=$2`, [idBodega, idProducto]))
        .rows[0].cantidad_disponible
    );

  const vender = (body: Record<string, unknown>, cliente = idCliente) =>
    POST_VENTA(
      createMockRequest("/api/ventas", {
        method: "POST",
        user: testUserEmpleado,
        body: {
          id_cliente: cliente,
          tipo_entrega: "EN_TIENDA",
          lineas: [{ id_producto: idProducto, id_bodega: idBodega, cantidad: 10, precio_unitario_venta: 10 }],
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
    idBodega = (await pool.query(`INSERT INTO bodega (nombre_bodega) VALUES ($1) RETURNING id_bodega`, [`Bodega-${sufijo}`])).rows[0].id_bodega;
    await pool.query(`INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo) VALUES ($1,$2,1000,0)`, [idBodega, idProducto]);

    idCliente = (
      await pool.query(`INSERT INTO cliente (nombre, correo, tipo_cliente) VALUES ($1,$2,'MINORISTA') RETURNING id_cliente`, [`Cliente ${sufijo}`, `c-${sufijo}@test.com`])
    ).rows[0].id_cliente;
    idClienteMayorista = (
      await pool.query(`INSERT INTO cliente (nombre, correo, tipo_cliente) VALUES ($1,$2,'MAYORISTA') RETURNING id_cliente`, [`Mayorista ${sufijo}`, `m-${sufijo}@test.com`])
    ).rows[0].id_cliente;

    // Regla por escala: 1+ -> 0%, 5+ -> 10%, 20+ -> 20%. Asignada al cliente.
    idRegla = (
      await pool.query(`INSERT INTO descuento (nombre, tipo) VALUES ($1,'ESCALA') RETURNING id_descuento`, [`Regla ${sufijo}`])
    ).rows[0].id_descuento;
    await pool.query(
      `INSERT INTO descuento_tramo (id_descuento, cantidad_desde, porcentaje) VALUES ($1,1,0),($1,5,10),($1,20,20)`,
      [idRegla]
    );
    await pool.query(`INSERT INTO descuento_asignacion (id_descuento, id_cliente) VALUES ($1,$2)`, [idRegla, idCliente]);
  });

  afterAll(async () => {
    const ids = [idCliente, idClienteMayorista];
    await pool.query(`DELETE FROM factura WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente = ANY($1))`, [ids]);
    await pool.query(`DELETE FROM deuda WHERE id_cliente = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM detalle_venta WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente = ANY($1))`, [ids]);
    await pool.query(`DELETE FROM venta WHERE id_cliente = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM kardex WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM bodega_producto WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM descuento WHERE id_descuento = $1`, [idRegla]); // asignaciones/tramos en cascada
    await pool.query(`DELETE FROM cliente WHERE id_cliente = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM bodega WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM producto WHERE id_producto = $1`, [idProducto]);
    await pool.query(`DELETE FROM marca WHERE id_marca = $1`, [idMarca]);
    await pool.query(`DELETE FROM categoria WHERE id_categoria = $1`, [idCategoria]);
    await pool.end();
  });

  it("aplica el tramo correspondiente y deja el total y el subtotal netos", async () => {
    // 10 unidades × Q10 = Q100 bruto. Tramo 5+ => 10% => Q10 de descuento.
    const res = await vender({});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(90);
    expect(data.descuento_total).toBe(10);

    const venta = (await pool.query(`SELECT total, descuento_total FROM venta WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(Number(venta.total)).toBe(90);
    expect(Number(venta.descuento_total)).toBe(10);

    const detalle = (await pool.query(`SELECT subtotal, descuento_porcentaje, descuento_monto, id_descuento, descuento_nombre FROM detalle_venta WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(Number(detalle.subtotal)).toBe(90);
    expect(Number(detalle.descuento_porcentaje)).toBe(10);
    expect(Number(detalle.descuento_monto)).toBe(10);
    expect(detalle.id_descuento).toBe(idRegla);
    expect(detalle.descuento_nombre).toBe(`Regla ${sufijo}`);
  });

  it("no aplica la regla a un cliente sin asignación", async () => {
    const res = await vender({}, idClienteMayorista);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(100);
    expect(data.descuento_total).toBe(0);
  });

  it("el descuento alimenta el crédito, la factura y la deuda (total neto)", async () => {
    const res = await vender({ condicion_pago: "CREDITO", credito: { plazo_dias: 30, numero_cuotas: 1 } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.credito.cuotas[0].monto).toBe(90);

    const factura = (await pool.query(`SELECT total_factura FROM factura WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(Number(factura.total_factura)).toBe(90);
    const deuda = (await pool.query(`SELECT monto_total FROM deuda WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(Number(deuda.monto_total)).toBe(90);
  });

  it("los reportes siguen cuadrando: SUM(v.total) == SUM(dv.subtotal)", async () => {
    const r = await pool.query(
      `SELECT
         COALESCE(SUM(v.total), 0)::numeric AS total_ventas,
         COALESCE((SELECT SUM(dv.subtotal) FROM detalle_venta dv
                    JOIN venta v2 ON v2.id_venta = dv.id_venta
                   WHERE v2.id_cliente = ANY($1) AND v2.estado_venta <> 'CANCELADO'), 0)::numeric AS total_detalle
         FROM venta v WHERE v.id_cliente = ANY($1) AND v.estado_venta <> 'CANCELADO'`,
      [[idCliente, idClienteMayorista]]
    );
    expect(Number(r.rows[0].total_ventas)).toBe(Number(r.rows[0].total_detalle));
  });

  it("anular una venta con descuento restaura el stock sin dejar inconsistencias", async () => {
    const stockAntes = await stock();
    const res = await vender({});
    const { id_venta } = await res.json();
    expect(await stock()).toBe(stockAntes - 10);

    const anul = await POST_ANULAR(createMockRequest(`/api/ventas/${id_venta}/anular`, { method: "POST", user: testUserEmpleado }), ctx(id_venta));
    expect(anul.status).toBe(200);
    expect(await stock()).toBe(stockAntes);

    const venta = (await pool.query(`SELECT estado_venta, total, descuento_total FROM venta WHERE id_venta=$1`, [id_venta])).rows[0];
    expect(venta.estado_venta).toBe("CANCELADO");
    // El total neto y el descuento quedan como snapshot histórico.
    expect(Number(venta.total)).toBe(90);
    expect(Number(venta.descuento_total)).toBe(10);
  });
});
