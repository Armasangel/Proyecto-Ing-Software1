/**
 * @jest-environment node
 */
// __tests__/integration/detalle-venta-cascade.test.ts
//
// Prueba contra Postgres real que borrar una venta borra en cascada
// sus filas de detalle_venta (ON DELETE CASCADE en fk_dv_venta).
//
// Requiere DATABASE_URL. Si no está definida, la suite se salta.

import { Pool } from "pg";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("ON DELETE CASCADE — detalle_venta -> venta (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let idCategoria: number;
  let idMarca: number;
  let idProducto: number;
  let idCliente: number;
  let idVenta: number;

  beforeAll(async () => {
    const sufijo = `cascade-${Date.now()}`;

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

    const cliente = await pool.query(
      `INSERT INTO cliente (nombre, correo) VALUES ($1, $2) RETURNING id_cliente`,
      [`Cliente ${sufijo}`, `cliente-${sufijo}@test.com`]
    );
    idCliente = cliente.rows[0].id_cliente;

    const venta = await pool.query(
      `INSERT INTO venta (id_cliente, tipo_venta, tipo_entrega, total)
       VALUES ($1, 'MINORISTA', 'EN_TIENDA', 30.00) RETURNING id_venta`,
      [idCliente]
    );
    idVenta = venta.rows[0].id_venta;

    await pool.query(
      `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, 3, 10.00, 30.00)`,
      [idVenta, idProducto]
    );
  });

  afterAll(async () => {
    // No hace falta borrar detalle_venta: si el cascade funcionó, ya no existe.
    await pool.query(`DELETE FROM detalle_venta WHERE id_venta = $1`, [idVenta]); // no-op si el cascade ya limpió
    await pool.query(`DELETE FROM venta WHERE id_venta = $1`, [idVenta]);
    await pool.query(`DELETE FROM cliente WHERE id_cliente = $1`, [idCliente]);
    await pool.query(`DELETE FROM producto WHERE id_producto = $1`, [idProducto]);
    await pool.query(`DELETE FROM marca WHERE id_marca = $1`, [idMarca]);
    await pool.query(`DELETE FROM categoria WHERE id_categoria = $1`, [idCategoria]);
    await pool.end();
  });

  it("borra las filas de detalle_venta automáticamente al borrar la venta", async () => {
    const antes = await pool.query(`SELECT * FROM detalle_venta WHERE id_venta = $1`, [idVenta]);
    expect(antes.rows.length).toBe(1);

    await pool.query(`DELETE FROM venta WHERE id_venta = $1`, [idVenta]);

    const despues = await pool.query(`SELECT * FROM detalle_venta WHERE id_venta = $1`, [idVenta]);
    expect(despues.rows.length).toBe(0);

    const ventaBorrada = await pool.query(`SELECT * FROM venta WHERE id_venta = $1`, [idVenta]);
    expect(ventaBorrada.rows.length).toBe(0);
  });
});