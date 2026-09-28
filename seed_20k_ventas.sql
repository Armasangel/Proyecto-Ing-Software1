-- ============================================================================
-- Semilla de volumen para VOL-02 / VOL-03: ~20,000 ventas (+ su detalle,
-- kardex, pagos y facturas).
--
-- POR QUE NO SE SUBIO EL BLOQUE DO DE init/01_schema.sql
-- Ese bloque genera las ventas con un loop procedural PL/pgSQL que hace
-- "SELECT ... ORDER BY random() LIMIT 1" por iteracion (~12 statements por
-- venta). A 20,000 ventas son ~240,000 statements, y como vive en
-- docker-entrypoint-initdb.d el arranque del contenedor de Postgres se queda
-- esperando (docker compose up parece colgado, varios minutos). Ademas
-- modificaria un archivo versionado del repo por un tema que es solo de pruebas.
--
-- Esta version es set-based (INSERT ... SELECT ... generate_series): tarda
-- segundos, no bloquea el arranque y no toca ningun archivo del repo.
-- Se aplica dentro del Postgres del Docker y es reversible con el TRUNCATE
-- de la seccion "ROLLBACK" al final.
--
-- Misma distribucion que el bloque original: 365 dias, horas 8-20, estados
-- ponderados (50% PAGADO, 20% ENTREGADO, 12% CONFIRMADO, 12% PENDIENTE,
-- 6% CANCELADO), 70% EN_TIENDA, 30% online, 1-4 productos por venta.
--
-- La cantidad de productos por venta se deriva de id_venta (no de random())
-- para que el paso 2 y el 3 sean consistentes entre si: random() no es
-- estable entre statements, y si el total quedara desfasado del detalle
-- estariamos midiendo datos invalidos.
-- ============================================================================

BEGIN;

SET LOCAL synchronous_commit = off;

-- Marca del lote: todo lo que se inserte despues de este maximo es de la
-- semilla. Hace el script re-ejecutable aunque la secuencia de venta ya
-- haya avanzado (las secuencias NO hacen rollback, asi que no sirve
-- hardcodear "id_venta > 180").
CREATE TEMP TABLE semilla_marca ON COMMIT DROP AS
  SELECT COALESCE(MAX(id_venta), 0) AS max_previo FROM venta;

-- ── Paso 1: las 20,000 ventas (total en 0, se calcula en el paso 3) ──────
INSERT INTO venta
  (id_cliente, id_empleado, fecha_venta, estado_venta, tipo_venta,
   tipo_entrega, direccion_entrega, enlinea, total)
SELECT
  cli.id_cliente,
  CASE WHEN v.r_emp < 0.75 THEN emp.id_usuario ELSE NULL END,
  v.fecha_venta,
  v.estado_venta,
  cli.tipo_cliente,
  v.tipo_entrega,
  CASE WHEN v.tipo_entrega = 'DOMICILIO'
       THEN 'Zona ' || (1 + (v.i % 20))::text || ', Guatemala'
       ELSE NULL END,
  v.r_emp < 0.30,
  0
FROM (
  SELECT
    g::int AS i,
    (NOW() - (floor(random() * 365) || ' days')::interval)::date
      + ((8 + floor(random() * 13) || ' hours')::interval)
      + ((floor(random() * 60) || ' minutes')::interval)      AS fecha_venta,
    r_emp,
    CASE
      WHEN r_est < 0.50 THEN 'PAGADO'
      WHEN r_est < 0.70 THEN 'ENTREGADO'
      WHEN r_est < 0.82 THEN 'CONFIRMADO'
      WHEN r_est < 0.94 THEN 'PENDIENTE'
      ELSE 'CANCELADO'
    END                                                    AS estado_venta,
    CASE WHEN r_ent < 0.7 THEN 'EN_TIENDA' ELSE 'DOMICILIO' END AS tipo_entrega
  FROM (
    SELECT
      g,
      random() AS r_est,
      random() AS r_ent,
      random() AS r_emp
    FROM generate_series(1, 20000) g
  ) r
) v
CROSS JOIN LATERAL (
  SELECT c.id_cliente, c.tipo_cliente
  FROM cliente c
  ORDER BY random() LIMIT 1
) cli
CROSS JOIN LATERAL (
  SELECT u.id_usuario
  FROM usuario u
  ORDER BY random() LIMIT 1
) emp;

-- ── Paso 2: 1 a 4 lineas de detalle por venta ───────────────────────────
-- Los productos se eligen solo de bodega_producto para que el INSERT de
-- kardex del paso 4 no rompa el FK fk_kardex_bp.
INSERT INTO detalle_venta
  (id_venta, id_producto, id_bodega, cantidad, precio_unitario, subtotal)
SELECT
  v.id_venta,
  p.id_producto,
  p.id_bodega,
  ROUND((1 + ((v.id_venta * 13 + k.n * 7) % 9))::numeric,
        CASE WHEN (v.id_venta + k.n) % 2 = 0 THEN 0 ELSE 2 END)          AS cantidad,
  ROUND((CASE WHEN c.tipo_cliente = 'MAYORISTA'
              THEN p.precio_mayoreo ELSE p.precio_unitario END)::numeric, 2)
                                                                          AS precio_unitario,
  ROUND(
    (CASE WHEN c.tipo_cliente = 'MAYORISTA'
          THEN p.precio_mayoreo ELSE p.precio_unitario END)
    * (1 + ((v.id_venta * 13 + k.n * 7) % 9)), 2)                         AS subtotal
FROM venta v
JOIN cliente c ON c.id_cliente = v.id_cliente
CROSS JOIN LATERAL generate_series(1, 1 + (v.id_venta % 4)) k(n)
CROSS JOIN LATERAL (
  SELECT bp.id_bodega, pr.id_producto, pr.precio_unitario, pr.precio_mayoreo
  FROM bodega_producto bp
  JOIN producto pr ON pr.id_producto = bp.id_producto
  ORDER BY pr.id_producto
  OFFSET ((v.id_venta * 13 + k.n * 7) % 7) LIMIT 1
) p
WHERE v.id_venta > (SELECT max_previo FROM semilla_marca);

-- ── Paso 3: total de cada venta = suma de su detalle ───────────────────
UPDATE venta v
SET total = d.total
FROM (
  SELECT id_venta, ROUND(SUM(subtotal), 2) AS total
  FROM detalle_venta
  GROUP BY id_venta
) d
WHERE d.id_venta = v.id_venta
  AND v.id_venta > (SELECT max_previo FROM semilla_marca);

-- ── Paso 4: salidas de kardex (para "top bodegas" en Reportes) ──────────
INSERT INTO kardex
  (id_bodega, id_producto, fecha_movimiento, tipo_movimiento, cantidad, descripcion)
SELECT
  dv.id_bodega, dv.id_producto, v.fecha_venta, 'SALIDA', dv.cantidad,
  'Venta #' || v.id_venta
FROM detalle_venta dv
JOIN venta v ON v.id_venta = dv.id_venta
WHERE v.id_venta > (SELECT max_previo FROM semilla_marca)
  AND dv.id_bodega IS NOT NULL;

-- ── Paso 5: pago para las ventas PAGADO ────────────────────────────────
INSERT INTO pago (id_venta, fecha_pago, monto, metodo)
SELECT
  v.id_venta,
  v.fecha_venta + INTERVAL '5 minutes',
  v.total,
  (ARRAY['TARJETA','EFECTIVO','TRANSFERENCIA'])[1 + (v.id_venta % 3)]
FROM venta v
WHERE v.estado_venta = 'PAGADO'
  AND v.id_venta > (SELECT max_previo FROM semilla_marca);

-- ── Paso 6: factura para las ventas PAGADO o ENTREGADO ─────────────────
-- num_fact arranca en 9,000,000: las facturas de la semilla original usan
-- FAC-1001..FAC-1124, asi que no hay colision con uq_factura_numero.
INSERT INTO factura (id_venta, numero_factura, nombre_cliente, nit_cliente, total_factura)
SELECT
  v.id_venta,
  'FAC-' || (9000000 + ROW_NUMBER() OVER (ORDER BY v.id_venta))::text,
  c.nombre, c.nit_cliente, v.total
FROM venta v
JOIN cliente c ON c.id_cliente = v.id_cliente
WHERE v.estado_venta IN ('PAGADO','ENTREGADO')
  AND v.id_venta > (SELECT max_previo FROM semilla_marca);

COMMIT;

-- Actualiza estadisticas para que el planner use un plan realista.
ANALYZE venta;
ANALYZE detalle_venta;
ANALYZE kardex;

-- ══════════════════════════════════════════════════════════════════════════
-- ROLLBACK de la semilla (dejar la BD con las 180 ventas originales).
-- El id de corte es el MAX(id_venta) que se uso como marca al sembrar; con
-- la secuencia ya avanzada no se puede volver a asumir "id_venta > 180".
-- Reemplazar :corte por el valor real (esta corrida: 20180).
--
--   BEGIN;
--   DELETE FROM factura        WHERE id_venta > :corte;
--   DELETE FROM pago           WHERE id_venta > :corte;
--   DELETE FROM kardex         WHERE descripcion LIKE 'Venta #%'
--                               AND id_kardex NOT IN (
--                                 SELECT id_kardex FROM kardex
--                                 WHERE id_kardex <= :corte);
--   DELETE FROM detalle_venta  WHERE id_venta > :corte;
--   DELETE FROM venta          WHERE id_venta > :corte;
--   COMMIT;
--   ANALYZE venta;
--
-- Ojo: la fila de kardex no tiene columna id_venta, asi que el DELETE de
-- kardex usa descripcion. Verificar el corte antes de ejecutar, porque un
-- corte erroneo borra datos de la semilla original.
--
-- Alternativa mucho mas simple y segura: tirar el volumen y recrear la BD
--   docker compose down -v && docker compose up -d
-- ══════════════════════════════════════════════════════════════════════════
