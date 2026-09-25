-- 05_solicitud_promocion_dueno.sql
--
-- Proceso de dos pasos para ascender a un usuario a tipo DUENO:
--   1. Un dueño existente pide el ascenso para otro usuario ya registrado
--      (solicitar). Se valida que aún no se llegue a MAX_DUENOS
--      (lib/roles.ts) y se genera un código de 6 dígitos que se manda al
--      correo del propio dueño que solicita (no al usuario objetivo).
--   2. El dueño confirma con ese código (confirmar). Recién ahí se aplica
--      el cambio de tipo_usuario, revalidando el límite otra vez por si
--      hubo otra promoción de por medio.
--
-- Mismo mecanismo que codigo_verificacion (2FA de login): código hasheado,
-- vencimiento corto, límite de intentos y de un solo uso.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/05_solicitud_promocion_dueno.sql

CREATE TABLE IF NOT EXISTS solicitud_promocion_dueno (
    id_solicitud          SERIAL          PRIMARY KEY,
    id_usuario_objetivo   INT             NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_dueno_solicitante  INT             NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    codigo_hash           VARCHAR(255)    NOT NULL,
    creado_en             TIMESTAMP       NOT NULL DEFAULT NOW(),
    expira_en             TIMESTAMP       NOT NULL,
    usado                 BOOLEAN         NOT NULL DEFAULT FALSE,
    intentos              INT             NOT NULL DEFAULT 0
);

-- Búsqueda rápida de "la solicitud vigente más reciente para este usuario objetivo".
CREATE INDEX IF NOT EXISTS idx_solicitud_promocion_dueno_objetivo
    ON solicitud_promocion_dueno (id_usuario_objetivo, creado_en DESC);
