-- 12_cliente_codigo.sql
--
-- Agrega el CÓDIGO de cliente:
--
--   * cliente.codigo_cliente (VARCHAR 20): identificador corto y legible que
--     el negocio puede entregar al cliente (carné, número de socio, etc.).
--     Es único y es por este código que se busca a un cliente en Ventas,
--     Cuentas por Cobrar, Órdenes y el resto de pantallas.
--
--   * Los clientes que ya existían reciben un código correlativo CLI-00001,
--     CLI-00002, ... asignado por orden de alta (no por id, para que el
--     correlativo no tenga huecos si algún cliente se borró).
--
--   * La secuencia cliente_codigo_seq sirve para los códigos nuevos: el
--     backend la usa cuando el colaborador NO escribe un código a mano.
--     Es el mismo patrón que factura_numero_seq (ver init/01_schema.sql) —
--     el número lo genera Postgres, no JavaScript, para que nunca se repita
--     aunque dos altas ocurrir en el mismo milisegundo.
--
--   * uq_cliente_codigo impide que dos clientes tengan el mismo código. El
--     backend traduce el error 23505 a un mensaje claro ("Ya existe un
--     cliente con ese código").
--
--   * La comparación de códigos es insensible a mayúsculas: el backend
--     normaliza a mayúsculas al guardar (ver lib/clientes-codigo.ts).
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/12_cliente_codigo.sql
-- (idempotente: se puede correr más de una vez)

-- 1) La columna. Va nullable a propósito: se llena con el backfill del punto 3
--    y a partir de ahí el backend siempre manda un código (autogenerado si el
--    colaborador no escribe uno).
ALTER TABLE cliente
    ADD COLUMN IF NOT EXISTS codigo_cliente VARCHAR(20);

-- 2) La secuencia para los códigos autogenerados.
CREATE SEQUENCE IF NOT EXISTS cliente_codigo_seq
    START WITH 1
    INCREMENT BY 1;

-- 3) Backfill: cada cliente recibe un código correlativo según su orden de
--    alta. row_number() evita huecos y garantiza que los códigos sean únicos
--    incluso si algún id_cliente fue borrado.
UPDATE cliente c
SET codigo_cliente = 'CLI-' || LPAD(rn::text, 5, '0')
FROM (
    SELECT id_cliente, ROW_NUMBER() OVER (ORDER BY id_cliente) AS rn
    FROM cliente
) t
WHERE c.id_cliente = t.id_cliente
  AND c.codigo_cliente IS NULL;

-- 4) La secuencia sigue donde quedó el backfill, para que el próximo código
--    autogenerado no repita ninguno de los ya asignados. Se usa el sufijo
--    numérico más alto ya guardado (y no COUNT(*)) porque si algún cliente
--    fue borrado el conteo quedaría corto y se repetiría un código.
SELECT setval(
    'cliente_codigo_seq',
    GREATEST(
        COALESCE(
            (
                SELECT MAX(substring(codigo_cliente from '[0-9]+$')::bigint)
                FROM cliente
                WHERE codigo_cliente ~ '[0-9]+$'
            ),
            0
        ),
        1
    )
);

-- 5) Unicidad. DROP + ADD deja la sentencia apta para repetirse.
ALTER TABLE cliente
    DROP CONSTRAINT IF EXISTS uq_cliente_codigo;
ALTER TABLE cliente
    ADD CONSTRAINT uq_cliente_codigo UNIQUE (codigo_cliente);
