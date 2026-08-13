-- init/05_codigo_verificacion.sql
--
-- FEATURE: verificación en 2 pasos por correo. Después de validar usuario
-- y contraseña, se genera un código de 6 dígitos con vencimiento corto y
-- se manda por email; el login solo se completa si el código es correcto.

CREATE TABLE IF NOT EXISTS codigo_verificacion (
    id_codigo       SERIAL          PRIMARY KEY,
    id_usuario      INT             NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    codigo_hash     VARCHAR(255)    NOT NULL,
    creado_en       TIMESTAMP       NOT NULL DEFAULT NOW(),
    expira_en       TIMESTAMP       NOT NULL,
    usado           BOOLEAN         NOT NULL DEFAULT FALSE,
    intentos        INT             NOT NULL DEFAULT 0
);

-- Búsqueda rápida de "el código vigente más reciente de este usuario".
CREATE INDEX IF NOT EXISTS idx_codigo_verificacion_usuario
    ON codigo_verificacion (id_usuario, creado_en DESC);