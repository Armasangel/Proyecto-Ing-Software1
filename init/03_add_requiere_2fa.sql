-- init/03_add_requiere_2fa.sql
--
-- Migración incremental para bases de datos EXISTENTES (donde ya corriste
-- 01_schema.sql antes y no quieres perder los datos). Agrega la columna
-- requiere_2fa a usuario, para poder eximir a colaboradores puntuales del
-- código de verificación por correo (2FA) sin tocar su tipo_usuario.
--
-- Por defecto TRUE para no bajar la seguridad de nadie que ya existe.
-- Solo tiene efecto real sobre usuarios EMPLEADO: DUENO y BODEGUERO nunca
-- pasan por 2FA sin importar este valor (ver app/api/login/route.ts).
--
-- Uso (con la base ya corriendo):
--   docker compose exec -T db psql -U <usuario> -d <basededatos> < init/03_add_requiere_2fa.sql
-- o, si te conectas directo con psql:
--   psql -U <usuario> -d <basededatos> -f init/03_add_requiere_2fa.sql
--
-- Es seguro correrlo más de una vez (IF NOT EXISTS).

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS requiere_2fa BOOLEAN NOT NULL DEFAULT TRUE;
INSERT INTO usuario (nombre, correo, telefono, contrasena_hash, tipo_usuario, requiere_2fa)
VALUES (
  'Empleado Sin 2FA',
  'sin2fa@tienda.com',
  '50205556666',
  '$2b$10$fHirMqOPU1ORDgfFCxkfG.PetZXrQ9XEjVwKgAfM4BnmIVDXL7cUm',
  'EMPLEADO',
  FALSE
);