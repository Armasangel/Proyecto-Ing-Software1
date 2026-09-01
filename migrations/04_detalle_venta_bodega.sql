-- 004_detalle_venta_bodega.sql
-- Agrega id_bodega a detalle_venta, necesario para poder restaurar el
-- stock correctamente al deshacer/anular una venta.
-- Las ventas ya registradas quedan con id_bodega NULL (no se pueden
-- deshacer retroactivamente, pero tampoco rompen nada — el resto de la
-- app no depende de esta columna).
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/004_detalle_venta_bodega.sql

ALTER TABLE detalle_venta
  ADD COLUMN IF NOT EXISTS id_bodega INT REFERENCES bodega(id_bodega);
