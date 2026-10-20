-- presentacion_producto ya es una tabla relacionada con producto.
-- Solo completamos equivalencias faltantes: no se cambian IDs, factores,
-- estados ni referencias de kardex/detalle_orden existentes.
-- Puede ejecutarse varias veces. También se aplica en instalaciones nuevas.
BEGIN;

WITH unidades(alias, nombre) AS (VALUES
  (ARRAY['libra','libras','lb','lbs'], 'Libra'),
  (ARRAY['litro','litros','l','lt','lts'], 'Litro'),
  (ARRAY['mililitro','mililitros','ml'], 'Mililitro'),
  (ARRAY['kilogramo','kilogramos','kilo','kilos','kg'], 'Kilogramo'),
  (ARRAY['gramo','gramos','g','gr'], 'Gramo'),
  (ARRAY['unidad','unidades','und','u'], 'Unidad'),
  (ARRAY['botella','botellas'], 'Botella'),
  (ARRAY['galon','galones'], 'Galón')
)
INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion)
SELECT p.id_producto, COALESCE(u.nombre, TRIM(p.unidad_medida)), 1
FROM producto p
LEFT JOIN unidades u
  ON LOWER(TRANSLATE(TRIM(p.unidad_medida), 'áéíóúü', 'aeiouu')) = ANY(u.alias)
WHERE NOT EXISTS (
  SELECT 1 FROM presentacion_producto pp
  WHERE pp.id_producto = p.id_producto
    AND (LOWER(TRIM(pp.nombre_presentacion)) = LOWER(COALESCE(u.nombre, TRIM(p.unidad_medida)))
         OR (pp.estado_presentacion AND pp.factor_conversion = 1))
)
ON CONFLICT (id_producto, nombre_presentacion) DO NOTHING;

INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion)
SELECT p.id_producto, v.nombre, v.factor
FROM producto p
CROSS JOIN (VALUES
  ('Arroba (25 libras)', 25),
  ('Saco de 50 libras', 50),
  ('Quintal (100 libras)', 100)
) AS v(nombre, factor)
WHERE LOWER(TRIM(p.unidad_medida)) IN ('libra','libras','lb','lbs')
  AND NOT EXISTS (
    SELECT 1 FROM presentacion_producto pp
    WHERE pp.id_producto = p.id_producto AND LOWER(TRIM(pp.nombre_presentacion)) = LOWER(v.nombre)
  )
ON CONFLICT (id_producto, nombre_presentacion) DO NOTHING;

-- Si el nombre de la unidad base ya existía desactivado, se conserva ese
-- registro y se agrega una alternativa libre para que el producto tenga
-- al menos una presentación activa, sin reactivar bajas anteriores.
INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion)
SELECT p.id_producto, libre.nombre, 1
FROM producto p
CROSS JOIN LATERAL (
  SELECT 'Unidad base: ' || TRIM(p.unidad_medida) || CASE WHEN n = 0 THEN '' ELSE ' (' || n || ')' END AS nombre
  FROM generate_series(0, (SELECT COUNT(*)::int + 1 FROM presentacion_producto pp WHERE pp.id_producto = p.id_producto)) AS g(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM presentacion_producto pp
    WHERE pp.id_producto = p.id_producto
      AND LOWER(pp.nombre_presentacion) = LOWER('Unidad base: ' || TRIM(p.unidad_medida) || CASE WHEN n = 0 THEN '' ELSE ' (' || n || ')' END)
  )
  ORDER BY n LIMIT 1
) libre
WHERE NOT EXISTS (
  SELECT 1 FROM presentacion_producto pp WHERE pp.id_producto = p.id_producto AND pp.estado_presentacion
);

COMMIT;
