-- 05_promocion_dueno_y_notificaciones_deuda.sql
--
-- Todos los cambios de base de datos de dos features relacionadas con
-- seguridad y cobros: el límite/proceso de ascenso a DUENO, y el sistema
-- de notificación automática de deudas pendientes. Se combinan en un solo
-- archivo para correr una sola migración en vez de dos sueltas.
--
-- ═══ Parte 1: Ascenso a DUENO con verificación (reemplaza lo que antes
-- era 05_solicitud_promocion_dueno.sql) ════════════════════════════════
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

-- ═══ Parte 2: Notificaciones automáticas de deuda (reemplaza lo que antes
-- era 06_notificaciones_deuda.sql) ══════════════════════════════════════
--
-- configuracion_notificaciones_deuda: fila única (id = 1) con lo que
-- configura el dueño — cada cuántos días se le vuelve a recordar a un
-- cliente su deuda pendiente, y si el envío automático está activo.
--
-- notificacion_deuda: bitácora de cada recordatorio enviado (a quién,
-- cuánto se le notificó y cuándo). Sirve para saber si ya le toca a un
-- cliente un nuevo recordatorio (última notificación + intervalo_dias) y
-- como historial visible para el dueño.

CREATE TABLE IF NOT EXISTS configuracion_notificaciones_deuda (
    id                SMALLINT        PRIMARY KEY DEFAULT 1,
    activo            BOOLEAN         NOT NULL DEFAULT FALSE,
    intervalo_dias    INT             NOT NULL DEFAULT 7 CHECK (intervalo_dias > 0),
    actualizado_en    TIMESTAMP       NOT NULL DEFAULT NOW(),
    actualizado_por   INT             REFERENCES usuario(id_usuario),
    CONSTRAINT chk_configuracion_notificaciones_deuda_fila_unica CHECK (id = 1)
);

-- Fila única sembrada de una vez (apagado por defecto: el dueño lo activa
-- explícitamente desde la UI cuando quiera empezar a mandar recordatorios).
INSERT INTO configuracion_notificaciones_deuda (id, activo, intervalo_dias)
VALUES (1, FALSE, 7)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS notificacion_deuda (
    id_notificacion     SERIAL          PRIMARY KEY,
    id_cliente          INT             NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    monto_notificado    NUMERIC(12,2)   NOT NULL,
    cantidad_deudas     INT             NOT NULL,
    enviado_en          TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Búsqueda rápida de "cuándo fue la última notificación de este cliente".
CREATE INDEX IF NOT EXISTS idx_notificacion_deuda_cliente
    ON notificacion_deuda (id_cliente, enviado_en DESC);

-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/05_promocion_dueno_y_notificaciones_deuda.sq
