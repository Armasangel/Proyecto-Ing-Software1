/**
 * @jest-environment node
 */
// __tests__/integration/ventas-stock-race.test.ts
//
// Este test usa la base de datos POSTGRES REAL (no mocks), porque una
// race condition de stock solo se puede reproducir de verdad con
// transacciones y locking reales — con `pool.query` mockeado no hay
// forma de simular dos transacciones concurrentes peleando por la misma fila.
//
// Requiere DATABASE_URL apuntando a la base del docker-compose
// (levantala con `docker compose up -d db` antes de correr este test).
// Si DATABASE_URL no está definida, la suite completa se salta.

import { Pool } from "pg";
import { POST as POST_VENTA } from "@/app/api/ventas/route";
import { createMockRequest, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("Race condition de stock — ventas concurrentes (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let idCategoria: number;
  let idMarca: number;
  let idProducto: number;
  let idBodega: number;
  let idCliente: number;

  const STOCK_INICIAL = 10; // unidades disponibles
  const CANTIDAD_POR_VENTA = 6; // cada venta pide 6 → juntas piden 12, más de lo disponible

  beforeAll(async () => {
    // Datos base mínimos, aislados con nombres únicos para no chocar con otros tests/datos.
    const sufijo = `race-${Date.now()}`;

    const cat = await pool.query(
      `INSERT INTO categoria (nombre_categoria) VALUES ($1) RETURNING id_categoria`,
      [`Cat-${sufijo}`]
    );
    idCategoria = cat.rows[0].id_categoria;

    const marca = await pool.query(
      `INSERT INTO marca (nombre_marca) VALUES ($1) RETURNING id_marca`,
      [`Marca-${sufijo}`]
    );
    idMarca = marca.rows[0].id_marca;

    const prod = await pool.query(
      `INSERT INTO producto (codigo_producto, nombre_producto, precio_unitario, unidad_medida, id_categoria, id_marca)
       VALUES ($1, $2, 10.00, 'unidad', $3, $4) RETURNING id_producto`,
      [`PROD-${sufijo}`, `Producto ${sufijo}`, idCategoria, idMarca]
    );
    idProducto = prod.rows[0].id_producto;

    const bodega = await pool.query(
      `INSERT INTO bodega (nombre_bodega) VALUES ($1) RETURNING id_bodega`,
      [`Bodega-${sufijo}`]
    );
    idBodega = bodega.rows[0].id_bodega;

    await pool.query(
      `INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
       VALUES ($1, $2, $3, 0)`,
      [idBodega, idProducto, STOCK_INICIAL]
    );

    const cliente = await pool.query(
      `INSERT INTO cliente (nombre, correo) VALUES ($1, $2) RETURNING id_cliente`,
      [`Cliente ${sufijo}`, `cliente-${sufijo}@test.com`]
    );
    idCliente = cliente.rows[0].id_cliente;
  });

  afterAll(async () => {
    // Limpieza en orden inverso a las FKs.
    await pool.query(`DELETE FROM kardex WHERE id_bodega = $1 AND id_producto = $2`, [idBodega, idProducto]);
    await pool.query(
      `DELETE FROM detalle_venta WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_cliente = $1)`,
      [idCliente]
    );
    await pool.query(`DELETE FROM venta WHERE id_cliente = $1`, [idCliente]);
    await pool.query(`DELETE FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`, [idBodega, idProducto]);
    await pool.query(`DELETE FROM cliente WHERE id_cliente = $1`, [idCliente]);
    await pool.query(`DELETE FROM bodega WHERE id_bodega = $1`, [idBodega]);
    await pool.query(`DELETE FROM producto WHERE id_producto = $1`, [idProducto]);
    await pool.query(`DELETE FROM marca WHERE id_marca = $1`, [idMarca]);
    await pool.query(`DELETE FROM categoria WHERE id_categoria = $1`, [idCategoria]);
    await pool.end();
  });

  it("no permite que dos ventas concurrentes sobregiren el stock del mismo producto/bodega", async () => {
    const hacerVenta = () => {
      const req = createMockRequest("/api/ventas", {
        method: "POST",
        user: testUserEmpleado,
        body: {
          id_cliente: idCliente,
          estado_venta: "PENDIENTE",
          tipo_venta: "MINORISTA",
          tipo_entrega: "EN_TIENDA",
          lineas: [
            {
              id_producto: idProducto,
              id_bodega: idBodega,
              cantidad: CANTIDAD_POR_VENTA,
              precio_unitario_venta: 10.0,
            },
          ],
        },
      });
      return POST_VENTA(req);
    };

    // Disparamos las dos ventas AL MISMO TIEMPO (Promise.all), no una después de la otra.
    // Antes del fix (SELECT sin FOR UPDATE), ambas podían leer "10 disponibles"
    // y las dos pasaban la validación, dejando el stock en negativo.
    const [res1, res2] = await Promise.all([hacerVenta(), hacerVenta()]);
    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    const resultados = [
      { status: res1.status, data: data1 },
      { status: res2.status, data: data2 },
    ];

    const exitosas = resultados.filter((r) => r.status === 200);
    const rechazadas = resultados.filter((r) => r.status !== 200);

    // Con 10 disponibles y 6 por venta, solo UNA de las dos puede completarse.
    expect(exitosas.length).toBe(1);
    expect(rechazadas.length).toBe(1);
    expect(rechazadas[0].data.error).toMatch(/stock insuficiente/i);

    // La prueba definitiva: el stock final nunca debe quedar negativo,
    // y debe ser exactamente STOCK_INICIAL - CANTIDAD_POR_VENTA (una sola venta aplicada).
    const stockFinal = await pool.query(
      `SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2`,
      [idBodega, idProducto]
    );
    const disponible = Number(stockFinal.rows[0].cantidad_disponible);

    expect(disponible).toBe(STOCK_INICIAL - CANTIDAD_POR_VENTA);
    expect(disponible).toBeGreaterThanOrEqual(0);
  });
});