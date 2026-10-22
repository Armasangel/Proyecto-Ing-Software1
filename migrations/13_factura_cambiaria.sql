-- 13_factura_cambiaria.sql
--
-- Agrega el TIPO DE DOCUMENTO a la facturación:
--
--   * factura.tipo_documento: FACTURA (documento normal) o
--     FACTURA_CAMBIARIA (documento de crédito que incorpora la promesa de pago).
--     Las facturas que ya existían quedan como FACTURA.
--
--   * factura.direccion_cliente: snapshot de la dirección del cliente al
--     emitir el documento. Igual que nombre_cliente y nit_cliente, se guarda
--     para que el documento impreso no cambie si después se edita el cliente.
--
--   * La factura cambiaria usa los datos ampliados del cliente (NIT y
--     dirección, ver migrations/11_cliente_datos_extra.sql): el backend exige
--     que el cliente tenga un NIT distinto de "CF" y una dirección registrada
--     antes de emitirla.
--
--   * El número del documento sigue saliendo de factura_numero_seq. Cambia el
--     prefijo: FACT-000001 para factura y FCAM-000001 para factura cambiaria.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/13_factura_cambiaria.sql
-- (idempotente: se puede correr más de una vez)

ALTER TABLE factura
    ADD COLUMN IF NOT EXISTS tipo_documento    VARCHAR(20);
ALTER TABLE factura
    ADD COLUMN IF NOT EXISTS direccion_cliente VARCHAR(255);

-- Las facturas anteriores a esta migración son facturas normales.
UPDATE factura
SET tipo_documento = 'FACTURA'
WHERE tipo_documento IS NULL;

-- Se completa la dirección de las facturas históricas con la del cliente.
UPDATE factura f
SET direccion_cliente = c.direccion
FROM venta v
JOIN cliente c ON c.id_cliente = v.id_cliente
WHERE f.id_venta = v.id_venta
  AND f.direccion_cliente IS NULL;

ALTER TABLE factura
    ALTER COLUMN tipo_documento SET DEFAULT 'FACTURA';
ALTER TABLE factura
    ALTER COLUMN tipo_documento SET NOT NULL;

DO $$
BEGIN
    ALTER TABLE factura
        DROP CONSTRAINT IF EXISTS factura_tipo_documento_check;
    ALTER TABLE factura
        ADD CONSTRAINT factura_tipo_documento_check
            CHECK (tipo_documento IN ('FACTURA', 'FACTURA_CAMBIARIA'));
END $$;

CREATE INDEX IF NOT EXISTS idx_factura_tipo_documento ON factura (tipo_documento);
