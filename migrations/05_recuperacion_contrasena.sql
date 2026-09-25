-- 05_recuperacion_contrasena.sql
-- Tabla de códigos de recuperación de contraseña (flujo "olvidé mi contraseña").
-- Aplica a todos los tipos de usuario (DUENO, EMPLEADO, BODEGUERO). Estructura
-- idéntica a codigo_verificacion (2FA): código de 6 dígitos hasheado, vigencia
-- corta y máx. 5 intentos.
-- Segura de correr más de una vez (usa IF NOT EXISTS).
--
-- Cómo correrla (solo en bases ya inicializadas):
--   psql -U <usuario> -d <basedatos> -f migrations/05_recuperacion_contrasena.sql
--
-- En bases nuevas no hace falta: ya viene en init/01_schema.sql.

CREATE TABLE IF NOT EXISTS codigo_recuperacion (
    id_recuperacion SERIAL          PRIMARY KEY,
    id_usuario      INT             NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    codigo_hash     VARCHAR(255)    NOT NULL,
    creado_en       TIMESTAMP       NOT NULL DEFAULT NOW(),
    expira_en       TIMESTAMP       NOT NULL,
    usado           BOOLEAN         NOT NULL DEFAULT FALSE,
    intentos        INT             NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_codigo_recuperacion_usuario
    ON codigo_recuperacion (id_usuario, creado_en DESC);