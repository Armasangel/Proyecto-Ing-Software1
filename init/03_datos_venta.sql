-- init/03_datos_venta.sql
-- Datos de prueba: ventas, detalle de venta, kardex, pagos y facturas.
-- Corre automáticamente la primera vez que Docker crea el contenedor
-- de PostgreSQL (junto con 01_schema.sql y 02_ordenes.sql).
-- Si la BD ya existe (volumen postgres_data), ejecutar manualmente:
--   docker exec -i <contenedor_pg> psql -U dsm_user -d deposito_san_miguel -f /docker-entrypoint-initdb.d/03_datos_venta.sql
--
-- Objetivo: la sección de Reportes (app/reportes + app/api/estadisticas)
-- necesita ventas reales para poder calcular resúmenes, series por día/hora,
-- top de productos/clientes, ingresos por categoría y salidas de kardex por
-- bodega. El seed original (01_schema.sql) solo crea catálogo, sin ventas.

-- ── Más productos (para que "top productos" e "ingresos por categoría"
--    tengan variedad — usamos la categoría Bebidas que ya existía sin uso) ──
INSERT INTO producto (codigo_producto, nombre_producto, precio_unitario, precio_mayoreo, unidad_medida, id_categoria, id_marca)
VALUES
  ('FRI-001', 'Frijol 1 libra',        6.00,  5.00, 'libra',   1, 1),
  ('BEB-001', 'Coca-Cola 1.5L',       12.00, 10.00, 'unidad',  3, 1),
  ('BEB-002', 'Agua pura 600ml',       4.00,  3.25, 'unidad',  3, 1),
  ('LEC-002', 'Yogurt Dos Pinos 1L',   8.50,  7.00, 'unidad',  2, 3)
ON CONFLICT (codigo_producto) DO NOTHING;

INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
SELECT 1, p.id_producto, 100, 15
FROM producto p
WHERE p.codigo_producto IN ('FRI-001', 'BEB-001', 'BEB-002', 'LEC-002')
ON CONFLICT (id_bodega, id_producto) DO NOTHING;

-- ── Más clientes (para "top clientes") ──────────────────────────────────
INSERT INTO cliente (nombre, correo, telefono, tipo_cliente) VALUES
  ('Lucia Rodriguez',  'lucia.rodriguez@gmail.com', '50201112222', 'MINORISTA'),
  ('Jorge Estrada',    'jorge.estrada@gmail.com',   '50203334444', 'MINORISTA'),
  ('Distribuidora Sol','ventas@disol.com',          '50205556666', 'MAYORISTA'),
  ('Ana Morales',      'ana.morales@gmail.com',     '50207778888', 'MINORISTA')
ON CONFLICT (correo) DO NOTHING;

-- ── Generación de ventas de prueba (últimos 365 días) ───────────────────
-- Solo corre si todavía no hay ventas, para poder re-ejecutar el archivo
-- sin duplicar datos.
DO $$
DECLARE
  v_id_venta       INT;
  v_id_cliente     INT;
  v_tipo_cliente   VARCHAR(20);
  v_id_empleado    INT;
  v_id_bodega      INT := (SELECT id_bodega FROM bodega ORDER BY id_bodega LIMIT 1);
  v_fecha          TIMESTAMP;
  v_estado         VARCHAR(20);
  v_tipo_entrega   VARCHAR(20);
  v_total          NUMERIC(12,2);
  v_num_items      INT;
  v_id_producto    INT;
  v_precio         NUMERIC(10,2);
  v_cantidad       NUMERIC(12,3);
  v_subtotal       NUMERIC(12,2);
  v_roll           NUMERIC;
  v_hora           INT;
  i                INT;
  j                INT;
  n_ventas         INT := 180;
  numero_fact      INT := 1000;
BEGIN
  IF EXISTS (SELECT 1 FROM venta) THEN
    RAISE NOTICE 'Ya existen ventas, se omite la generación de datos de prueba.';
    RETURN;
  END IF;

  FOR i IN 1..n_ventas LOOP
    -- Cliente al azar
    SELECT id_cliente, tipo_cliente INTO v_id_cliente, v_tipo_cliente
    FROM cliente ORDER BY random() LIMIT 1;

    -- Empleado al azar (puede ser NULL para ventas en línea)
    v_roll := random();
    IF v_roll < 0.75 THEN
      SELECT id_usuario INTO v_id_empleado FROM usuario ORDER BY random() LIMIT 1;
    ELSE
      v_id_empleado := NULL;
    END IF;

    -- Fecha dentro de los últimos 365 días, con hora concentrada en horario
    -- de tienda (8-20h) para que "actividad por hora" tenga forma realista.
    v_hora := 8 + floor(random() * 13)::int; -- 8..20
    v_fecha := (NOW() - (random() * INTERVAL '365 days'))::date
                + (v_hora || ' hours')::interval
                + (floor(random() * 60) || ' minutes')::interval;

    -- Estado ponderado
    v_roll := random();
    v_estado := CASE
      WHEN v_roll < 0.50 THEN 'PAGADO'
      WHEN v_roll < 0.70 THEN 'ENTREGADO'
      WHEN v_roll < 0.82 THEN 'CONFIRMADO'
      WHEN v_roll < 0.94 THEN 'PENDIENTE'
      ELSE 'CANCELADO'
    END;

    v_tipo_entrega := CASE WHEN random() < 0.7 THEN 'EN_TIENDA' ELSE 'DOMICILIO' END;

    -- Crear venta (total se actualiza luego de insertar el detalle)
    INSERT INTO venta (id_cliente, id_empleado, fecha_venta, estado_venta, tipo_venta, tipo_entrega, direccion_entrega, enlinea, total)
    VALUES (
      v_id_cliente, v_id_empleado, v_fecha, v_estado, v_tipo_cliente, v_tipo_entrega,
      CASE WHEN v_tipo_entrega = 'DOMICILIO' THEN 'Zona ' || (1 + floor(random()*20))::text || ', Guatemala' ELSE NULL END,
      random() < 0.3,
      0
    )
    RETURNING id_venta INTO v_id_venta;

    -- 1 a 4 productos por venta
    v_total := 0;
    v_num_items := 1 + floor(random() * 4)::int;

    FOR j IN 1..v_num_items LOOP
      SELECT id_producto INTO v_id_producto FROM producto ORDER BY random() LIMIT 1;
      v_cantidad := round((1 + random() * 9)::numeric, CASE WHEN random() < 0.5 THEN 0 ELSE 2 END);

      SELECT CASE WHEN v_tipo_cliente = 'MAYORISTA' THEN precio_mayoreo ELSE precio_unitario END
      INTO v_precio FROM producto WHERE id_producto = v_id_producto;

      v_subtotal := round(v_precio * v_cantidad, 2);
      v_total := v_total + v_subtotal;

      INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
      VALUES (v_id_venta, v_id_producto, v_cantidad, v_precio, v_subtotal);

      -- Salida de kardex correspondiente (para "top bodegas")
      INSERT INTO kardex (id_bodega, id_producto, fecha_movimiento, tipo_movimiento, cantidad, descripcion)
      VALUES (v_id_bodega, v_id_producto, v_fecha, 'SALIDA', v_cantidad, 'Venta #' || v_id_venta)
      ON CONFLICT DO NOTHING;
    END LOOP;

    UPDATE venta SET total = v_total WHERE id_venta = v_id_venta;

    -- Pago para ventas PAGADO
    IF v_estado = 'PAGADO' THEN
      INSERT INTO pago (id_venta, fecha_pago, monto, metodo)
      VALUES (
        v_id_venta, v_fecha + INTERVAL '5 minutes', v_total,
        (ARRAY['TARJETA','EFECTIVO','TRANSFERENCIA'])[1 + floor(random()*3)]
      );
    END IF;

    -- Factura para ventas PAGADO o ENTREGADO
    IF v_estado IN ('PAGADO', 'ENTREGADO') THEN
      numero_fact := numero_fact + 1;
      INSERT INTO factura (id_venta, numero_factura, nombre_cliente, nit_cliente, total_factura)
      SELECT v_id_venta, 'FAC-' || numero_fact::text, c.nombre, c.nit_cliente, v_total
      FROM cliente c WHERE c.id_cliente = v_id_cliente;
    END IF;
  END LOOP;

  RAISE NOTICE 'Generadas % ventas de prueba con su detalle, kardex, pagos y facturas.', n_ventas;
END $$;
  