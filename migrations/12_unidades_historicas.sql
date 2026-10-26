-- Ejecutar ANTES de corregir unidades del catálogo. No altera cantidades.
BEGIN;
ALTER TABLE kardex ADD COLUMN IF NOT EXISTS unidad_base VARCHAR(50);
ALTER TABLE detalle_venta ADD COLUMN IF NOT EXISTS unidad_base VARCHAR(50);
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS unidad_base VARCHAR(50);
ALTER TABLE deuda_producto ADD COLUMN IF NOT EXISTS unidad_base VARCHAR(50);

UPDATE kardex k SET unidad_base = pp.unidad_base
FROM presentacion_producto pp
WHERE k.id_presentacion = pp.id_presentacion AND k.unidad_base IS NULL;
UPDATE detalle_orden d SET unidad_base = pp.unidad_base
FROM presentacion_producto pp WHERE d.id_presentacion = pp.id_presentacion AND d.unidad_base IS NULL;
UPDATE detalle_venta dv SET unidad_base = d.unidad_base
FROM detalle_orden d JOIN orden o ON o.id_orden = d.id_orden
WHERE o.id_venta = dv.id_venta AND d.id_producto = dv.id_producto AND d.unidad_base IS NOT NULL AND dv.unidad_base IS NULL;
UPDATE deuda_producto dp SET unidad_base = dv.unidad_base
FROM deuda de JOIN detalle_venta dv ON dv.id_venta = de.id_venta
WHERE dp.id_deuda = de.id_deuda AND dp.id_producto = dv.id_producto AND dv.unidad_base IS NOT NULL AND dp.unidad_base IS NULL;

DO $$ DECLARE tabla text; BEGIN
  FOREACH tabla IN ARRAY ARRAY['kardex','detalle_orden','detalle_venta','deuda_producto'] LOOP
    EXECUTE format('UPDATE %I h SET unidad_base = p.unidad_medida FROM producto p WHERE h.id_producto = p.id_producto AND h.unidad_base IS NULL', tabla);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN unidad_base SET NOT NULL', tabla);
  END LOOP;
END $$;

-- Cubre todos los puntos de escritura, incluidas ventas, ajustes y traslados.
CREATE OR REPLACE FUNCTION conservar_unidad_historica()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unidad_actual text; id_pres int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.unidad_base := OLD.unidad_base;
    RETURN NEW;
  END IF;
  SELECT unidad_medida INTO unidad_actual FROM producto
  WHERE id_producto = NEW.id_producto FOR KEY SHARE;
  IF NEW.unidad_base IS NULL THEN
    id_pres := (to_jsonb(NEW)->>'id_presentacion')::int;
    IF id_pres IS NOT NULL THEN
      SELECT unidad_base INTO NEW.unidad_base FROM presentacion_producto
      WHERE id_presentacion = id_pres AND id_producto = NEW.id_producto;
    END IF;
    NEW.unidad_base := COALESCE(NEW.unidad_base, unidad_actual);
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tabla text; BEGIN
  FOREACH tabla IN ARRAY ARRAY['kardex','detalle_venta','detalle_orden','deuda_producto'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_unidad_historica ON %I', tabla);
    EXECUTE format('CREATE TRIGGER trg_unidad_historica BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION conservar_unidad_historica()', tabla);
  END LOOP;
END $$;
COMMIT;
