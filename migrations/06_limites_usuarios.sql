-- 06_limites_usuarios.sql
--
-- Límite configurable de usuarios ACTIVOS por tipo (DUENO, EMPLEADO,
-- BODEGUERO), administrado desde la pestaña de Usuarios.
--
--   * limite_tipo_usuario: un renglón por tipo. max_usuarios NULL = sin límite.
--     DUENO arranca en 2 (el valor que antes estaba fijo en MAX_DUENOS).
--   * solicitud_cambio_limite: cambiar un límite exige verificación en 2
--     pasos (código de 6 dígitos al correo del dueño que lo pide), con el
--     mismo mecanismo que solicitud_promocion_dueno: código hasheado,
--     vencimiento corto, límite de intentos y de un solo uso.
--   * Trigger trg_validar_limite_usuarios: aplica el límite en la propia BD
--     (alta de usuario, cambio de tipo o reactivación), con un advisory lock
--     por tipo para que dos altas simultáneas no se pasen del tope.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/06_limites_usuarios.sql

CREATE TABLE IF NOT EXISTS limite_tipo_usuario (
    tipo_usuario     VARCHAR(20)  PRIMARY KEY CHECK (tipo_usuario IN ('DUENO', 'EMPLEADO', 'BODEGUERO')),
    max_usuarios     INT          CHECK (max_usuarios IS NULL OR max_usuarios >= 1),
    actualizado_en   TIMESTAMP    NOT NULL DEFAULT NOW(),
    actualizado_por  INT          REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

INSERT INTO limite_tipo_usuario (tipo_usuario, max_usuarios) VALUES
    ('DUENO', 2),
    ('EMPLEADO', NULL),
    ('BODEGUERO', NULL)
ON CONFLICT (tipo_usuario) DO NOTHING;

CREATE TABLE IF NOT EXISTS solicitud_cambio_limite (
    id_solicitud          SERIAL       PRIMARY KEY,
    tipo_usuario          VARCHAR(20)  NOT NULL CHECK (tipo_usuario IN ('DUENO', 'EMPLEADO', 'BODEGUERO')),
    nuevo_limite          INT          CHECK (nuevo_limite IS NULL OR nuevo_limite >= 1),
    id_dueno_solicitante  INT          NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    codigo_hash           VARCHAR(255) NOT NULL,
    creado_en             TIMESTAMP    NOT NULL DEFAULT NOW(),
    expira_en             TIMESTAMP    NOT NULL,
    usado                 BOOLEAN      NOT NULL DEFAULT FALSE,
    intentos              INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_solicitud_cambio_limite_solicitante
    ON solicitud_cambio_limite (id_dueno_solicitante, creado_en DESC);

-- Solo cuentan los usuarios ACTIVOS. Se valida al insertar, al cambiar el
-- tipo y al reactivar una cuenta; si no cambia ni el tipo ni el estado no
-- se revisa nada (así editar nombre/teléfono nunca falla por el límite).
-- Al fallar lanza el SQLSTATE 'LU001' con el tipo en DETAIL y el tope en HINT.
CREATE OR REPLACE FUNCTION fn_validar_limite_usuarios() RETURNS trigger AS $$
DECLARE
    v_limite  INT;
    v_activos INT;
BEGIN
    IF NEW.estado_usuario IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.tipo_usuario = NEW.tipo_usuario
       AND OLD.estado_usuario IS TRUE THEN
        RETURN NEW;
    END IF;

    -- Serializa altas/cambios del mismo tipo; el COUNT de abajo corre como
    -- sentencia nueva, así que ya ve lo que confirmó la transacción anterior.
    PERFORM pg_advisory_xact_lock(hashtext('limite_usuarios:' || NEW.tipo_usuario));

    SELECT max_usuarios INTO v_limite
    FROM limite_tipo_usuario
    WHERE tipo_usuario = NEW.tipo_usuario;

    IF v_limite IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_activos
    FROM usuario
    WHERE tipo_usuario = NEW.tipo_usuario
      AND estado_usuario IS TRUE
      AND id_usuario <> COALESCE(NEW.id_usuario, -1);

    IF v_activos >= v_limite THEN
        RAISE EXCEPTION 'LIMITE_USUARIOS'
            USING ERRCODE = 'LU001',
                  DETAIL  = NEW.tipo_usuario,
                  HINT    = v_limite::text;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_limite_usuarios ON usuario;
CREATE TRIGGER trg_validar_limite_usuarios
    BEFORE INSERT OR UPDATE OF tipo_usuario, estado_usuario ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_validar_limite_usuarios();
