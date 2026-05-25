-- init/02_cobranza.sql
-- Cobranza: columna faltante en venta, config x/y/z, índices, vista v_deudores ampliada.
-- Corre automáticamente en Docker solo si el volumen de Postgres es nuevo.
-- BD existente: psql -f init/02_cobranza.sql (ver README).

-- Bodega en venta (usada por rutas de ventas / mayorista)
ALTER TABLE venta
    ADD COLUMN IF NOT EXISTS id_bodega INT REFERENCES bodega(id_bodega);

-- Parámetros de cobranza (una fila; el dueño los ajustará después vía API)
CREATE TABLE configuracion_cobranza (
    id_config                   SERIAL PRIMARY KEY,
    dias_pre_recordatorio       INT NOT NULL DEFAULT 3,
    dias_post_recordatorio      INT NOT NULL DEFAULT 7,
    dias_escalamiento_critico   INT NOT NULL DEFAULT 14,
    ventana_analisis_compras    INT NOT NULL DEFAULT 5,
    actualizado_en              TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO configuracion_cobranza (dias_pre_recordatorio, dias_post_recordatorio, dias_escalamiento_critico)
VALUES (3, 7, 14);

CREATE INDEX IF NOT EXISTS idx_venta_fecha_limite_pago ON venta (fecha_limite_pago);
CREATE INDEX IF NOT EXISTS idx_venta_id_usuario ON venta (id_usuario);
CREATE INDEX IF NOT EXISTS idx_pago_id_venta ON pago (id_venta);

DROP VIEW IF EXISTS v_deudores;

CREATE VIEW v_deudores AS
SELECT
    v.id_venta,
    v.id_usuario,
    u.nombre                                AS nombre_cliente,
    u.correo,
    v.fecha_venta,
    v.fecha_limite_pago,
    v.estado_venta,
    v.total                                 AS total_venta,
    COALESCE(SUM(p.monto), 0)               AS total_pagado,
    v.total - COALESCE(SUM(p.monto), 0)   AS deuda_pendiente,
    CASE
        WHEN v.fecha_limite_pago IS NULL THEN 0
        ELSE GREATEST(0, CURRENT_DATE - v.fecha_limite_pago)
    END                                     AS dias_atraso,
    CASE
        WHEN v.fecha_limite_pago IS NULL THEN 'ACTIVO'
        WHEN CURRENT_DATE <= v.fecha_limite_pago THEN 'ACTIVO'
        WHEN (CURRENT_DATE - v.fecha_limite_pago) >
             (SELECT dias_escalamiento_critico FROM configuracion_cobranza ORDER BY id_config LIMIT 1)
            THEN 'CRITICO'
        ELSE 'VENCIDO'
    END                                     AS estado_cobro
FROM venta v
JOIN usuario u ON u.id_usuario = v.id_usuario
LEFT JOIN pago p ON p.id_venta = v.id_venta
WHERE v.estado_venta NOT IN ('PAGADO', 'CANCELADO')
GROUP BY
    v.id_venta,
    v.id_usuario,
    u.nombre,
    u.correo,
    v.fecha_venta,
    v.fecha_limite_pago,
    v.estado_venta,
    v.total
HAVING v.total - COALESCE(SUM(p.monto), 0) > 0;
