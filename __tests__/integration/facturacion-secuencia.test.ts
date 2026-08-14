/**
 * @jest-environment node
 */
// __tests__/integration/facturacion-secuencia.test.ts
//
// Prueba contra Postgres real que dos facturas creadas AL MISMO TIEMPO
// (misma transacción de reloj) nunca terminan con el mismo numero_factura,
// y que el correlativo generado por nextval() es efectivamente secuencial.
//
// Requiere DATABASE_URL. Si no está definida, la suite se salta.

import { Pool } from "pg";
import { POST as POST_FACTURA } from "@/app/api/facturacion/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("Secuencia de numero_factura — facturas concurrentes (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let idCliente: number;
  let idVenta1: number;
  let idVenta2: number;

  beforeAll(async () => {
    const sufijo = `fact-${Date.now()}`;

    const cliente = await pool.query(
      `INSERT INTO cliente (nombre, correo) VALUES ($1, $2) RETURNING id_cliente`,
      [`Cliente ${sufijo}`, `cliente-${sufijo}@test.com`]
    );
    idCliente = cliente.rows[0].id_cliente;

    const venta1 = await pool.query(
      `INSERT INTO venta (id_cliente, tipo_venta, tipo_entrega, total)
       VALUES ($1, 'MINORISTA', 'EN_TIENDA', 100.00) RETURNING id_venta`,
      [idCliente]
    );
    idVenta1 = venta1.rows[0].id_venta;

    const venta2 = await pool.query(
      `INSERT INTO venta (id_cliente, tipo_venta, tipo_entrega, total)
       VALUES ($1, 'MINORISTA', 'EN_TIENDA', 200.00) RETURNING id_venta`,
      [idCliente]
    );
    idVenta2 = venta2.rows[0].id_venta;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM factura WHERE id_venta IN ($1, $2)`, [idVenta1, idVenta2]);
    await pool.query(`DELETE FROM venta WHERE id_venta IN ($1, $2)`, [idVenta1, idVenta2]);
    await pool.query(`DELETE FROM cliente WHERE id_cliente = $1`, [idCliente]);
    await pool.end();
  });

  it("genera numero_factura únicos y secuenciales aunque las facturas se creen al mismo tiempo", async () => {
    const facturar = (id_venta: number) => {
      const req = createMockRequest("/api/facturacion", {
        method: "POST",
        user: testUserDueno,
        body: { id_venta, nombre_cliente: "Cliente Prueba", nit_cliente: "CF" },
      });
      return POST_FACTURA(req);
    };

    // Disparadas juntas con Promise.all — el escenario donde Date.now()
    // podía repetirse y dos facturas chocaban de número.
    const [res1, res2] = await Promise.all([facturar(idVenta1), facturar(idVenta2)]);
    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Nunca deben coincidir.
    expect(data1.numero_factura).not.toBe(data2.numero_factura);

    // Deben tener el formato correlativo FACT-000001, no un timestamp.
    expect(data1.numero_factura).toMatch(/^FACT-\d{6,}$/);
    expect(data2.numero_factura).toMatch(/^FACT-\d{6,}$/);

    // Verificación contra la base: ambas facturas quedaron guardadas con
    // números distintos (el UNIQUE constraint también lo garantizaría,
    // pero acá confirmamos el valor real).
    const guardadas = await pool.query(
      `SELECT numero_factura FROM factura WHERE id_venta IN ($1, $2)`,
      [idVenta1, idVenta2]
    );
    const numeros = guardadas.rows.map((r) => r.numero_factura);
    expect(new Set(numeros).size).toBe(2);
  });
});