-- Los tamaños (800 ml, 1 L, etc.) identifican productos, no presentaciones.
-- La migración 12 debe haberse aplicado para conservar unidades históricas.
BEGIN;
DO $$ DECLARE tabla text; BEGIN
  FOREACH tabla IN ARRAY ARRAY['kardex','detalle_venta','detalle_orden','deuda_producto'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = tabla::regclass AND attname = 'unidad_base' AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Aplica primero 12_unidades_historicas.sql';
    END IF;
  END LOOP;
END $$;
LOCK TABLE producto IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE liquidos_por_corregir ON COMMIT DROP AS
SELECT id_producto FROM producto
WHERE normalizar_unidad_presentacion(unidad_medida) IN ('litro','mililitro','galon')
   OR (codigo_producto IN ('BEB-001','BEB-002','LEC-002') AND normalizar_unidad_presentacion(unidad_medida) = 'unidad');
CREATE TEMP TABLE empaques_por_conservar ON COMMIT DROP AS
SELECT pp.id_producto, pp.nombre_presentacion, pp.factor_conversion
FROM presentacion_producto pp JOIN liquidos_por_corregir l USING (id_producto)
WHERE pp.unidad_base = 'unidad' AND pp.estado_presentacion AND pp.factor_conversion > 1;

UPDATE presentacion_producto pp SET estado_presentacion = FALSE
FROM liquidos_por_corregir l WHERE l.id_producto = pp.id_producto;
UPDATE producto p SET unidad_medida = 'botella'
FROM liquidos_por_corregir l WHERE l.id_producto = p.id_producto;

-- Los empaques por conteo (caja de 24 unidades) siguen siendo válidos para
-- 24 botellas; se crean nuevas filas, sin alterar las referenciadas antes.
INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion, unidad_base)
SELECT id_producto, nombre_presentacion, factor_conversion, 'botella' FROM empaques_por_conservar
ON CONFLICT (id_producto, unidad_base, nombre_presentacion) DO NOTHING;

-- Reutiliza equivalencias válidas de botella, sin cambiar sus factores.
UPDATE presentacion_producto pp SET estado_presentacion = TRUE
FROM liquidos_por_corregir l
WHERE l.id_producto = pp.id_producto AND pp.unidad_base = 'botella' AND pp.factor_conversion = 1;
INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion, unidad_base)
SELECT l.id_producto, libre.nombre, 1, 'botella'
FROM liquidos_por_corregir l
CROSS JOIN LATERAL (
  SELECT 'Botella' || CASE WHEN n = 0 THEN '' ELSE ' (' || n || ')' END AS nombre
  FROM generate_series(0, (SELECT COUNT(*)::int + 1 FROM presentacion_producto pp WHERE pp.id_producto = l.id_producto)) g(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM presentacion_producto pp WHERE pp.id_producto = l.id_producto AND pp.unidad_base = 'botella'
    AND pp.nombre_presentacion = 'Botella' || CASE WHEN n = 0 THEN '' ELSE ' (' || n || ')' END
  ) ORDER BY n LIMIT 1
) libre
WHERE NOT EXISTS (
  SELECT 1 FROM presentacion_producto pp WHERE pp.id_producto = l.id_producto AND pp.unidad_base = 'botella'
  AND pp.factor_conversion = 1 AND pp.estado_presentacion
);
COMMIT;
