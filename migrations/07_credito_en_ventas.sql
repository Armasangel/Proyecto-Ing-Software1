-- 07_credito_en_ventas.sql
--
-- Crédito integrado a Ventas: una venta puede ser de CONTADO (se paga completa
-- en ese momento) o a CRÉDITO (fecha de factura, plazo en días y cuotas). Al
-- vender a crédito se genera la factura y una cuenta por cobrar (tabla deuda)
-- ligada a la venta, con su plan de pagos.
--
--   * venta.condicion_pago: CONTADO | CREDITO.
--   * deuda.id_venta / plazo_dias / numero_cuotas: de qué venta nace la cuenta
--     por cobrar y en cuántas cuotas se paga.
--   * cuota_credito: plan de pagos (fecha de vencimiento y monto de cada
--     cuota). Los abonos (pago_deuda) se aplican en orden a las cuotas, así que
--     no hace falta marcar cuotas como pagadas a mano.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/07_credito_en_ventas.sql

ALTER TABLE venta
    ADD COLUMN IF NOT EXISTS condicion_pago VARCHAR(10) NOT NULL DEFAULT 'CONTADO'
        CHECK (condicion_pago IN ('CONTADO', 'CREDITO'));

ALTER TABLE deuda
    ADD COLUMN IF NOT EXISTS id_venta       INT UNIQUE REFERENCES venta(id_venta),
    ADD COLUMN IF NOT EXISTS plazo_dias     INT CHECK (plazo_dias IS NULL OR plazo_dias > 0),
    ADD COLUMN IF NOT EXISTS numero_cuotas  INT NOT NULL DEFAULT 1 CHECK (numero_cuotas >= 1);

CREATE TABLE IF NOT EXISTS cuota_credito (
    id_cuota           SERIAL         PRIMARY KEY,
    id_deuda           INT            NOT NULL REFERENCES deuda(id_deuda) ON DELETE CASCADE,
    numero             INT            NOT NULL CHECK (numero >= 1),
    fecha_vencimiento  DATE           NOT NULL,
    monto              NUMERIC(12,2)  NOT NULL CHECK (monto > 0),
    CONSTRAINT uq_cuota_credito_numero UNIQUE (id_deuda, numero)
);

CREATE INDEX IF NOT EXISTS idx_cuota_credito_vencimiento ON cuota_credito (fecha_vencimiento);
