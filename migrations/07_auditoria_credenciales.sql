-- 07_auditoria_credenciales.sql
--
-- Bitácora persistente de los eventos que cambian el acceso a una cuenta
-- (OWASP ASVS V7). Hasta ahora estos hechos sólo quedaban en logs de pino,
-- que se rotan (5 × 50 MB) y se pueden borrar: al caer, no había forma de
-- responder "¿quién entró a la caja y desde dónde?".
--
-- Segura de correr más de una vez (todo es IF NOT EXISTS).
--
-- Cómo correrla (solo en bases ya inicializadas):
--   psql -U <usuario> -d <basedatos> -f migrations/07_auditoria_credenciales.sql
--
-- En bases nuevas no hace falta: ya viene en init/01_schema.sql.

CREATE TABLE IF NOT EXISTS auditoria (
    id           SERIAL         PRIMARY KEY,
    id_usuario   INT            REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    -- Se guarda el correo aunque id_usuario quede NULL: al borrar la cuenta,
    -- el rastro de "qué cuenta estaba siendo atacada" tiene que sobrevivir.
    correo       VARCHAR(200),
    tipo_evento  VARCHAR(50)     NOT NULL,
    ip           VARCHAR(45),
    user_agent   TEXT,
    detalle      JSONB           NOT NULL DEFAULT '{}'::jsonb,
    -- timeless: se referencia para el dueño, no para la app. NOW() es lo
    -- correcto si el servidor y la app comparten zona horaria.
    creado_en    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Consulta principal del panel: "qué pasó, y en este orden".
CREATE INDEX IF NOT EXISTS idx_auditoria_created
    ON auditoria (creado_en DESC);

-- Filtro por cuenta concreta ("¿qué le pasó a este usuario?").
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
    ON auditoria (id_usuario, creado_en DESC);

-- Filtro por tipo ("sólo bloqueos de cuenta en la última semana").
CREATE INDEX IF NOT EXISTS idx_auditoria_tipo
    ON auditoria (tipo_evento, creado_en DESC);