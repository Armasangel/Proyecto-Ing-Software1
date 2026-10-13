-- 06_seguridad_credenciales.sql
--
-- Endurecimiento del manejo de credenciales (OWASP ASVS V2/V3):
--   1. sesion_version            → revocación inmediata de sesiones (JWT)
--   2. login_intento por clave   → bloqueo por cuenta, no solo por IP
--   3. debe_cambiar_contrasena   → obliga a cambiar contraseñas conocidas
--
-- Cómo correrla (solo en bases ya inicializadas):
--   psql -U <usuario> -d <basedatos> -f migrations/06_seguridad_credenciales.sql
--
-- En bases nuevas no hace falta: ya viene en init/01_schema.sql.

BEGIN;
-- ── 1. Revocación de sesiones ────────────────────────────────────────────────
-- El JWT lleva el valor de sesion_version como claim `sv`. Cada request lo
-- compara contra la fila actual del usuario: si no coincide (o el usuario está
-- deshabilitado), el token deja de servir. Subir el contador equivale a
-- "cerrar todas las sesiones" de ese usuario.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS sesion_version   INT  NOT NULL DEFAULT 1;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ultimo_login_en TIMESTAMP;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ultimo_login_ip  VARCHAR(45);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS requiere_cambio_contrasena BOOLEAN NOT NULL DEFAULT FALSE;

-- Contraseña conocida publicada en este repositorio (hash de "password123" en
-- init/01_schema.sql). A los usuarios que aún la usan se les exige cambiar la
-- contraseña en el próximo inicio de sesión; los demás no se tocan.
UPDATE usuario
   SET requiere_cambio_contrasena = TRUE
 WHERE requiere_cambio_contrasena = FALSE
   AND contrasena_hash IN (
       '$2b$10$fHirMqOPU1ORDgfFCxkfG.PetZXrQ9XEjVwKgAfM4BnmIVDXL7cUm'
   );

-- ── 2. Bloqueo por cuenta ────────────────────────────────────────────────────
-- Antes la tabla se indexaba solo por IP, así que un ataque distribuido
-- (muchas IP, una sola cuenta) nunca se contenía. 
ALTER TABLE login_intento RENAME COLUMN ip TO clave;

-- La columna quedó como NOT NULL por ser PK; se afloja para admitir claves
-- más largas (un correo puede pasar de 45 chars).
ALTER TABLE login_intento ALTER COLUMN clave TYPE VARCHAR(200);

COMMIT;
