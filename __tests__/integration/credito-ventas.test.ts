/**
 * @jest-environment node
 */
// __tests__/integration/credito-ventas.test.ts
//
// Flujo completo de crédito en Ventas contra Postgres REAL (migración 07):
// venta a crédito -> factura + cuenta por cobrar + cuotas -> abonos aplicados
// en orden -> venta pagada; límite de crédito; anulación.
//
// Requiere DATABASE_URL con el esquema al día (init/01_schema.sql o las
// migraciones 06 y 07). Si no está definida, la suite se salta.

import { Pool } from "pg";
import { POST as POST_VENTA } from "@/app/api/ventas/route";
import { GET as GET_DEUDAS } from "@/app/api/deudas/route";
import { POST as POST_PAGO } from "@/app/api/deudas/[id]/pagos/route";
import { POST as POST_ANULAR } from "@/app/api/ventas/[id]/anular/route";
import { createMockRequest, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { sumarDias } from "@/lib/credito";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("Crédito en ventas (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sufijo = `credito-${Date.now()}`;
  let idCategoria: number;
  let idMarca: number;
  let idProducto: number;
  let idBodega: number;
  let idCliente: number;
  let idClienteSinLimite: number;

  const stock = async () =>
    Number(
      (await pool.query(`SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega=$1 AND id_producto=$2`, [idBodega, idProducto]))
        .rows[0].cantidad_disponible
    );

  const hoy = async () => (await pool.query(`SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS hoy`)).rows[0].hoy as string;

  const vender = (body: Record<string, unknown>, cliente = idCliente) =>
    POST_VENTA(
      createMockRequest("/api/ventas", {
        method: "POST",
        user: testUserEmpleado,
        body: {
          id_cliente: cliente,
          tipo_entrega: "EN_TIENDA",
          lineas: [{ id_producto: idProducto, id_bodega: idBodega, cantidad: 12, precio_unitario_venta: 10 }],
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
    // Límite de crédito Q500: alcanza para una venta de Q120 pero no para varias.
    idCliente = (
      await pool.query(`INSERT INTO cliente (nombre, correo, limite_deuda, nit_cliente) VALUES ($1,$2,500,'1234567-8') RETURNING id_cliente`, [`Cliente ${sufijo}`, `c-${sufijo}@test.com`])
    ).rows[0].id_cliente;
    idClienteSinLimite = (
      await pool.query(`INSERT INTO cliente (nombre, correo) VALUES ($1,$2) RETURNING id_cliente`, [`Cliente B ${sufijo}`, `b-${sufijo}@test.com`])
    ).rows[0].id_cliente;
  });

  afterAll(async () => {
    const ids = [idCliente, idClienteSinLimite];
    await pool.query(`DELETE FROM pago_deuda WHERE id_deuda IN (SELECT id_deuda FROM deuda WHERE id_cliente = ANY($1))`, [ids]);
    await pool.query(`DELETE FROM deuda WHERE id_cliente = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM factura WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente = ANY($1))`, [ids]);
    await pool.query(`DELETE FROM detalle_venta WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente = ANY($1))`, [ids]);
    await pool.query(`DELETE FROM venta WHERE id_cliente = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM kardex WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM bodega_producto WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM cliente WHERE id_cliente = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM bodega WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM producto WHERE id_producto = $1`, [idProducto]);
    await pool.query(`DELETE FROM marca WHERE id_marca = $1`, [idMarca]);
    await pool.query(`DELETE FROM categoria WHERE id_categoria = $1`, [idCategoria]);
    await pool.end();
  });

  it("venta a crédito: genera factura, cuenta por cobrar con cuotas y descuenta stock", async () => {
    const stockAntes = await stock();
    const fechaFactura = sumarDias(await hoy(), -5); // factura "forzada" 5 días atrás
    const res = await vender({
      condicion_pago: "CREDITO",
      credito: { fecha_factura: fechaFactura, plazo_dias: 30, numero_cuotas: 2 },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.condicion_pago).toBe("CREDITO");
    expect(data.credito.numero_factura).toMatch(/^FACT-\d{6}$/);
    expect(data.credito.cuotas).toEqual([
      { numero: 1, fecha_vencimiento: sumarDias(fechaFactura, 15), monto: 60 },
      { numero: 2, fecha_vencimiento: sumarDias(fechaFactura, 30), monto: 60 },
    ]);

    const venta = (await pool.query(`SELECT * FROM venta WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(venta.condicion_pago).toBe("CREDITO");
    expect(venta.estado_venta).toBe("CONFIRMADO");
    expect(Number(venta.total)).toBe(120);
    expect(venta.fecha_venta.toISOString().slice(0, 10)).toBe(fechaFactura);

    const factura = (await pool.query(`SELECT * FROM factura WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(factura.nit_cliente).toBe("1234567-8");
    expect(Number(factura.total_factura)).toBe(120);

    const deuda = (await pool.query(`SELECT * FROM deuda WHERE id_venta=$1`, [data.id_venta])).rows[0];
    expect(Number(deuda.monto_total)).toBe(120);
    expect(deuda.plazo_dias).toBe(30);
    expect(deuda.numero_cuotas).toBe(2);
    expect(deuda.id_cliente).toBe(idCliente);
    const productos = (await pool.query(`SELECT * FROM deuda_producto WHERE id_deuda=$1`, [deuda.id_deuda])).rows;
    expect(productos).toHaveLength(1);
    expect(Number(productos[0].subtotal)).toBe(120);

    expect(await stock()).toBe(stockAntes - 12);
  });

  it("los abonos se aplican en orden a las cuotas y al saldar la venta pasa a PAGADO", async () => {
    const venta = (await pool.query(`SELECT id_venta FROM venta WHERE id_cliente=$1 AND condicion_pago='CREDITO' ORDER BY id_venta LIMIT 1`, [idCliente])).rows[0];
    const idDeuda = (await pool.query(`SELECT id_deuda FROM deuda WHERE id_venta=$1`, [venta.id_venta])).rows[0].id_deuda;

    const pagar = (monto: number) =>
      POST_PAGO(
        createMockRequest(`/api/deudas/${idDeuda}/pagos`, { method: "POST", user: testUserEmpleado, body: { monto, metodo_pago: "EFECTIVO" } }),
        ctx(idDeuda)
      );
    const cuotasDe = async () => {
      const r = await GET_DEUDAS(createMockRequest("/api/deudas", { user: testUserEmpleado }));
      const d = (await r.json()).deudas.find((x: { id_deuda: number }) => x.id_deuda === idDeuda);
      return d;
    };

    let d = await cuotasDe();
    expect(d.numero_factura).toMatch(/^FACT-/);
    // Facturada hace 5 días, vence la 1ª en +15: nada vencido todavía.
    expect(d.cuotas.map((c: { estado: string }) => c.estado)).toEqual(["PENDIENTE", "PENDIENTE"]);

    expect((await pagar(70)).status).toBe(201);
    d = await cuotasDe();
    expect(d.cuotas.map((c: { estado: string }) => c.estado)).toEqual(["PAGADA", "PARCIAL"]);
    expect(d.cuotas[1]).toMatchObject({ pagado: 10, saldo: 50 });
    expect((await pool.query(`SELECT estado_venta FROM venta WHERE id_venta=$1`, [venta.id_venta])).rows[0].estado_venta).toBe("CONFIRMADO");

    expect((await pagar(50)).status).toBe(201);
    expect((await pool.query(`SELECT estado_deuda FROM deuda WHERE id_deuda=$1`, [idDeuda])).rows[0].estado_deuda).toBe("PAGADA");
    expect((await pool.query(`SELECT estado_venta FROM venta WHERE id_venta=$1`, [venta.id_venta])).rows[0].estado_venta).toBe("PAGADO");
  });

  it("una cuota sin pagar después de su fecha aparece VENCIDA", async () => {
    const fechaFactura = sumarDias(await hoy(), -40);
    const res = await vender(
      { condicion_pago: "CREDITO", credito: { fecha_factura: fechaFactura, plazo_dias: 30, numero_cuotas: 1 } },
      idClienteSinLimite
    );
    expect(res.status).toBe(200);
    const { id_venta } = await res.json();
    const idDeuda = (await pool.query(`SELECT id_deuda FROM deuda WHERE id_venta=$1`, [id_venta])).rows[0].id_deuda;
    const r = await GET_DEUDAS(createMockRequest("/api/deudas", { user: testUserEmpleado }));
    const d = (await r.json()).deudas.find((x: { id_deuda: number }) => x.id_deuda === idDeuda);
    expect(d.cuotas[0].estado).toBe("VENCIDA");
  });

  it("rechaza el crédito que supera el límite del cliente, sin tocar stock ni crear nada", async () => {
    // Límite Q500; pendiente ya liquidado (Q0). Una venta de Q600 lo supera.
    const stockAntes = await stock();
    const ventasAntes = Number((await pool.query(`SELECT COUNT(*) FROM venta WHERE id_cliente=$1`, [idCliente])).rows[0].count);
    const res = await vender({
      condicion_pago: "CREDITO",
      credito: { plazo_dias: 30, numero_cuotas: 1 },
      lineas: [{ id_producto: idProducto, id_bodega: idBodega, cantidad: 60, precio_unitario_venta: 10 }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/límite/i);
    expect(await stock()).toBe(stockAntes);
    expect(Number((await pool.query(`SELECT COUNT(*) FROM venta WHERE id_cliente=$1`, [idCliente])).rows[0].count)).toBe(ventasAntes);
  });

  it.each([
    [{ plazo_dias: 0, numero_cuotas: 1 }],
    [{ plazo_dias: 30, numero_cuotas: 0 }],
    [{ plazo_dias: 3, numero_cuotas: 4 }],
    [{ plazo_dias: 30, numero_cuotas: 1, fecha_factura: "2026-02-30" }],
    [{ plazo_dias: 30, numero_cuotas: 1, fecha_factura: "2001-01-01" }],
  ])("rechaza condiciones de crédito inválidas %j", async (credito) => {
    const stockAntes = await stock();
    const res = await vender({ condicion_pago: "CREDITO", credito }, idClienteSinLimite);
    expect(res.status).toBe(400);
    expect(await stock()).toBe(stockAntes);
  });

  it("venta de contado: queda PAGADO y no genera factura ni cuenta por cobrar", async () => {
    const res = await vender({ condicion_pago: "CONTADO" }, idClienteSinLimite);
    expect(res.status).toBe(200);
    const { id_venta } = await res.json();
    const venta = (await pool.query(`SELECT estado_venta, condicion_pago FROM venta WHERE id_venta=$1`, [id_venta])).rows[0];
    expect(venta).toEqual({ estado_venta: "PAGADO", condicion_pago: "CONTADO" });
    expect((await pool.query(`SELECT 1 FROM deuda WHERE id_venta=$1`, [id_venta])).rowCount).toBe(0);
    expect((await pool.query(`SELECT 1 FROM factura WHERE id_venta=$1`, [id_venta])).rowCount).toBe(0);
  });

  it("deshacer una venta a crédito sin abonos retira su cuenta por cobrar y devuelve el stock", async () => {
    const stockAntes = await stock();
    const res = await vender({ condicion_pago: "CREDITO", credito: { plazo_dias: 15, numero_cuotas: 3 } });
    const { id_venta } = await res.json();
    expect(await stock()).toBe(stockAntes - 12);

    const anular = await POST_ANULAR(createMockRequest(`/api/ventas/${id_venta}/anular`, { method: "POST", user: testUserEmpleado }), ctx(id_venta));
    expect(anular.status).toBe(200);
    expect(await stock()).toBe(stockAntes);
    expect((await pool.query(`SELECT 1 FROM deuda WHERE id_venta=$1`, [id_venta])).rowCount).toBe(0);
    expect((await pool.query(`SELECT estado_venta FROM venta WHERE id_venta=$1`, [id_venta])).rows[0].estado_venta).toBe("CANCELADO");
  });

  it("no deja deshacer una venta a crédito que ya tiene abonos", async () => {
    const res = await vender({ condicion_pago: "CREDITO", credito: { plazo_dias: 15, numero_cuotas: 1 } });
    const { id_venta } = await res.json();
    const idDeuda = (await pool.query(`SELECT id_deuda FROM deuda WHERE id_venta=$1`, [id_venta])).rows[0].id_deuda;
    await POST_PAGO(createMockRequest(`/api/deudas/${idDeuda}/pagos`, { method: "POST", user: testUserEmpleado, body: { monto: 10 } }), ctx(idDeuda));

    const stockAntes = await stock();
    const anular = await POST_ANULAR(createMockRequest(`/api/ventas/${id_venta}/anular`, { method: "POST", user: testUserEmpleado }), ctx(id_venta));
    expect(anular.status).toBe(400);
    expect(await stock()).toBe(stockAntes);
    expect((await pool.query(`SELECT 1 FROM deuda WHERE id_venta=$1`, [id_venta])).rowCount).toBe(1);
  });
});
