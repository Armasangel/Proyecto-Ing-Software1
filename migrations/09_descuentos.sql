-- 09_descuentos.sql
--
-- Sistema de descuentos configurable por el dueño. Un descuento es una regla
-- con uno o más TRAMOS por cantidad de unidades; al registrar una venta el
-- servidor evalúa cada línea y aplica la regla asignada que más descuento dé.
--
--   * descuento: la regla (nombre, tipo, activo). El tipo es solo una etiqueta
--     para la UI; el cálculo SIEMPRE usa los tramos.
--       - PORCENTAJE: un tramo desde 0 unidades (ej. 0+ -> 5%).
--       - CANTIDAD:   un tramo desde N unidades (ej. 10+ -> 5%).
--       - ESCALA:     varios tramos (ej. 1-9 -> 0%, 10-49 -> 5%, 50+ -> 10%).
--   * descuento_tramo: cantidad_desde + porcentaje. Es la única fuente de
--     cálculo (ver lib/descuentos.ts). Todos los tipos se expresan con tramos.
--   * descuento_asignacion: a quién aplica. O bien un cliente puntual
--     (id_cliente) o bien un tipo de cliente (tipo_cliente). El CHECK obliga a
--     que venga exactamente uno de los dos.
--   * detalle_venta: snapshot del descuento por línea (porcentaje, monto y el
--     nombre de la regla). Estos campos NO dependen de la regla viva: editar o
--     borrar la regla no altera el historial. subtotal queda NETO (ya con el
--     descuento restado).
--   * venta.descuento_total: suma de los descuentos de todas las líneas. El
--     total de la venta sigue siendo la cifra neta que ya usan crédito,
--     factura, deuda y orden.
--
-- Los reportes que suman v.total y dv.subtotal por separado siguen cuadrando:
-- ambos quedan netos.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/09_descuentos.sql

CREATE TABLE IF NOT EXISTS descuento (
    id_descuento        SERIAL          PRIMARY KEY,
    nombre              VARCHAR(150)    NOT NULL,
    tipo                VARCHAR(20)     NOT NULL DEFAULT 'PORCENTAJE'
                            CHECK (tipo IN ('PORCENTAJE', 'CANTIDAD', 'ESCALA')),
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMP       NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMP       NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_descuento_nombre UNIQUE (nombre)
);

-- Tramo de una regla: desde `cantidad_desde` unidades (inclusive) aplica
-- `porcentaje`. El tramo ganador es el de mayor cantidad_desde que no supere
-- la cantidad de la línea. No puede repetirse cantidad_desde en la misma regla.
CREATE TABLE IF NOT EXISTS descuento_tramo (
    id_tramo            SERIAL          PRIMARY KEY,
    id_descuento        INT             NOT NULL REFERENCES descuento(id_descuento) ON DELETE CASCADE,
    cantidad_desde      NUMERIC(12,3)   NOT NULL CHECK (cantidad_desde >= 0),
    porcentaje          NUMERIC(5,2)    NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    CONSTRAINT uq_descuento_tramo_desde UNIQUE (id_descuento, cantidad_desde)
);

CREATE INDEX IF NOT EXISTS idx_descuento_tramo_regla ON descuento_tramo (id_descuento, cantidad_desde);

-- A quién se aplica la regla: un cliente puntual O un tipo de cliente, nunca
-- ambos. Ciclo de vida de la asignación independiente del de la regla.
CREATE TABLE IF NOT EXISTS descuento_asignacion (
    id_asignacion       SERIAL          PRIMARY KEY,
    id_descuento        INT             NOT NULL REFERENCES descuento(id_descuento) ON DELETE CASCADE,
    id_cliente          INT             REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    tipo_cliente        VARCHAR(20)     CHECK (tipo_cliente IN ('MINORISTA', 'MAYORISTA')),
    CONSTRAINT chk_asignacion_uno CHECK (
        (id_cliente IS NOT NULL AND tipo_cliente IS NULL) OR
        (id_cliente IS NULL AND tipo_cliente IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_descuento_asignacion_regla   ON descuento_asignacion (id_descuento);
CREATE INDEX IF NOT EXISTS idx_descuento_asignacion_cliente ON descuento_asignacion (id_cliente);

-- Snapshot del descuento aplicado a cada línea. subtotal queda NETO.
ALTER TABLE detalle_venta
    ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5,2)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS descuento_monto      NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS id_descuento         INT REFERENCES descuento(id_descuento) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS descuento_nombre     VARCHAR(150);

-- Total de descuento otorgado en la venta (suma de las líneas).
ALTER TABLE venta
    ADD COLUMN IF NOT EXISTS descuento_total NUMERIC(12,2) NOT NULL DEFAULT 0;
