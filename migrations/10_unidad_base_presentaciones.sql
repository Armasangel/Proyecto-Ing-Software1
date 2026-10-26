-- Cada presentación conserva la unidad en que se definió aunque se corrija
-- posteriormente la unidad del producto. No se convierten cantidades/precios.
BEGIN;

CREATE OR REPLACE FUNCTION normalizar_unidad_presentacion(unidad text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN u IN ('libra','libras','lb','lbs') THEN 'libra'
    WHEN u IN ('litro','litros','l','lt','lts') THEN 'litro'
    WHEN u IN ('mililitro','mililitros','ml') THEN 'mililitro'
    WHEN u IN ('kilogramo','kilogramos','kilo','kilos','kg') THEN 'kilogramo'
    WHEN u IN ('gramo','gramos','g','gr') THEN 'gramo'
    WHEN u IN ('unidad','unidades','und','u') THEN 'unidad'
    WHEN u IN ('botella','botellas') THEN 'botella'
    WHEN u IN ('galon','galones') THEN 'galon'
    ELSE u END
  FROM (SELECT LOWER(TRANSLATE(TRIM(unidad), 'áéíóúü', 'aeiouu')) AS u) normalizada;
$$;

ALTER TABLE presentacion_producto ADD COLUMN IF NOT EXISTS unidad_base VARCHAR(50);
UPDATE presentacion_producto pp
SET unidad_base = normalizar_unidad_presentacion(p.unidad_medida)
FROM producto p WHERE p.id_producto = pp.id_producto AND pp.unidad_base IS NULL;
ALTER TABLE presentacion_producto ALTER COLUMN unidad_base SET NOT NULL;

ALTER TABLE presentacion_producto DROP CONSTRAINT IF EXISTS uq_presentacion_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_presentacion_producto_unidad_nombre
ON presentacion_producto (id_producto, unidad_base, nombre_presentacion);

-- Compatibilidad con semillas y scripts que no envían unidad_base.
CREATE OR REPLACE FUNCTION completar_unidad_base_presentacion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unidad_base IS NULL THEN
    SELECT normalizar_unidad_presentacion(unidad_medida) INTO NEW.unidad_base
    FROM producto WHERE id_producto = NEW.id_producto;
  ELSE
    NEW.unidad_base := normalizar_unidad_presentacion(NEW.unidad_base);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_unidad_base_presentacion ON presentacion_producto;
CREATE TRIGGER trg_unidad_base_presentacion BEFORE INSERT ON presentacion_producto
FOR EACH ROW EXECUTE FUNCTION completar_unidad_base_presentacion();

COMMIT;
