-- 11_cliente_datos_extra.sql
--
-- Amplía los datos y los tipos de cliente:
--
--   * cliente.direccion (VARCHAR 255): domicilio del cliente.
--   * cliente.codigo_postal (VARCHAR 10): código postal del domicilio.
--   * cliente.nit_cliente ya existía (VARCHAR 20, default 'CF') — no se toca;
--     ahora además se captura desde los formularios de alta.
--   * tipo_cliente acepta además de MINORISTA/MAYORISTA los tipos EMPRESA y
--     GOBIERNO, en cliente y en descuento_asignacion (para poder asignar un
--     descuento a cualquiera de los tipos).
--
-- La venta sigue facturando solo como MINORISTA/MAYORISTA (tipo_venta): un
-- cliente EMPRESA/GOBIERNO compra a precio minorista salvo que el colaborador
-- fuerce el tipo de venta en Ventas.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/11_cliente_datos_extra.sql
-- (idempotente: se puede correr más de una vez)

ALTER TABLE cliente
    ADD COLUMN IF NOT EXISTS direccion     VARCHAR(255);
ALTER TABLE cliente
    ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(10);

-- Los CHECK creados por init/01_schema.sql / migrations/09_descuentos.sql se
-- llaman <tabla>_<columna>_check; se recrean con los tipos nuevos. DROP IF
-- EXISTS + ADD deja la sentencia apta para repetirse.
DO $$
BEGIN
    ALTER TABLE cliente
        DROP CONSTRAINT IF EXISTS cliente_tipo_cliente_check;
    ALTER TABLE cliente
        ADD CONSTRAINT cliente_tipo_cliente_check
            CHECK (tipo_cliente IN ('MINORISTA', 'MAYORISTA', 'EMPRESA', 'GOBIERNO'));

    ALTER TABLE descuento_asignacion
        DROP CONSTRAINT IF EXISTS descuento_asignacion_tipo_cliente_check;
    ALTER TABLE descuento_asignacion
        ADD CONSTRAINT descuento_asignacion_tipo_cliente_check
            CHECK (tipo_cliente IN ('MINORISTA', 'MAYORISTA', 'EMPRESA', 'GOBIERNO'));
END $$;
