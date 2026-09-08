-- 002_pagos_parciales_deuda.sql
-- Agrega soporte para abonos/pagos parciales sobre una deuda existente.
-- Segura de correr más de una vez (usa IF NOT EXISTS).
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/002_pagos_parciales_deuda.sql
-- o, si usan el docker-compose de este repo:
--   docker compose exec -T db psql -U postgres -d tienda -f - < migrations/002_pagos_parciales_deuda.sql

CREATE TABLE IF NOT EXISTS pago_deuda (
    id_pago         SERIAL          PRIMARY KEY,
    id_deuda        INT             NOT NULL,
    monto           NUMERIC(12,2)   NOT NULL CHECK (monto > 0),
    fecha_pago      TIMESTAMP       NOT NULL DEFAULT NOW(),
    id_usuario      INT             NOT NULL,
    metodo_pago     VARCHAR(30),
    nota            VARCHAR(200),
    CONSTRAINT fk_pago_deuda    FOREIGN KEY (id_deuda)   REFERENCES deuda(id_deuda) ON DELETE CASCADE,
    CONSTRAINT fk_pago_usuario  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_pago_deuda_id_deuda ON pago_deuda(id_deuda);
