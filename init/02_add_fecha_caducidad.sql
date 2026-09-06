-- init/02_add_fecha_caducidad.sql
--
-- Migración incremental para bases de datos EXISTENTES (donde ya corriste
-- 01_schema.sql antes y no quieres perder los datos). Agrega la columna
-- fecha_caducidad a producto, usada por el formulario ampliado de "Nuevo
-- producto".
--
-- Uso (con la base ya corriendo):
--   docker compose exec -T db psql -U <usuario> -d <basededatos> < init/02_add_fecha_caducidad.sql
-- o, si te conectas directo con psql:
--   psql -U <usuario> -d <basededatos> -f init/02_add_fecha_caducidad.sql
--
-- Es seguro correrlo más de una vez (IF NOT EXISTS).

ALTER TABLE producto
    ADD COLUMN IF NOT EXISTS fecha_caducidad DATE;
