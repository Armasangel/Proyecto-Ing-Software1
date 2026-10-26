-- La categoría actual sigue siendo la principal y conserva su NOT NULL.
-- Las adicionales comienzan en NULL, sin inventar clasificaciones.
BEGIN;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS id_categoria_2 INT REFERENCES categoria(id_categoria);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS id_categoria_3 INT REFERENCES categoria(id_categoria);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'producto'::regclass AND conname = 'ck_producto_categorias_distintas') THEN
    ALTER TABLE producto ADD CONSTRAINT ck_producto_categorias_distintas CHECK (
      (id_categoria_2 IS NULL OR id_categoria_2 <> id_categoria) AND
      (id_categoria_3 IS NULL OR id_categoria_3 <> id_categoria) AND
      (id_categoria_2 IS NULL OR id_categoria_3 IS NULL OR id_categoria_2 <> id_categoria_3)
    );
  END IF;
END $$;
COMMIT;
