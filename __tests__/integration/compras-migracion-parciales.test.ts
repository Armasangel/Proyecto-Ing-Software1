/** @jest-environment node */
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const suite=process.env.DATABASE_URL?describe:describe.skip;
suite('Compatibilidad de compras anteriores con entregas parciales',()=>{
  it('reabre productos omitidos, conserva los completos y el dinero, y es idempotente',async()=>{
    const pool=new Pool({connectionString:process.env.DATABASE_URL});
    const client=await pool.connect();
    const schema=`test_compras_${randomUUID().replace(/-/g,'')}`;
    try {
      // Esquema aislado: la migración de prueba nunca toca las tablas de la tienda.
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await client.query(`CREATE TABLE compra (id_compra INT PRIMARY KEY,estado TEXT,impuestos NUMERIC(12,2));
        CREATE TABLE compra_detalle (id_compra INT,id_producto INT,cantidad_base NUMERIC(12,3),unidad_base TEXT);
        CREATE TABLE compra_recepcion (id_recepcion INT PRIMARY KEY,id_compra INT,estado TEXT,conteo JSONB);
        INSERT INTO compra VALUES (1,'RECIBIDA',12.34),(2,'RECIBIDA',56.78),(3,'REVISION',90.12);
        INSERT INTO compra_detalle VALUES (1,10,1000,'libra'),(1,20,100,'botella'),(2,10,1000,'libra'),(3,10,1000,'libra'),(3,20,100,'botella');
        INSERT INTO compra_recepcion VALUES
          (1,1,'APLICADA','[{"id_producto":10,"cantidad_base":1000}]'),
          (2,2,'APLICADA','[{"id_producto":10,"cantidad_base":1000}]'),
          (3,3,'PENDIENTE_DUENO','[{"id_producto":10,"cantidad_base":950}]');`);
      const sql=readFileSync(resolve(process.cwd(),'migrations/15_compras_parciales_impuestos.sql'),'utf8');
      for(let i=0;i<2;i++)await client.query(sql);
      expect((await client.query(`SELECT estado,impuestos FROM compra ORDER BY id_compra`)).rows).toEqual([
        {estado:'PARCIAL',impuestos:'12.34'},{estado:'RECIBIDA',impuestos:'56.78'},{estado:'REVISION',impuestos:'90.12'},
      ]);
      const rec=(await client.query(`SELECT esperado,productos_cerrados FROM compra_recepcion ORDER BY id_recepcion`)).rows;
      expect(rec[0].productos_cerrados).toEqual([10]);
      expect(rec[2].esperado.map((e:{id_producto:number})=>e.id_producto)).toEqual([10]);
      expect(rec[2].productos_cerrados).toEqual([]);
    } finally {
      await client.query('ROLLBACK');
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      client.release();await pool.end();
    }
  });
});
