-- init/02_ordenes.sql
-- Tablas de ordenes de compra (sprint feature).
-- Ejecutar manualmente si la BD ya existe:
--   docker exec -i <contenedor_pg> psql -U postgres -d deposito_san_miguel -f /docker-entrypoint-initdb.d/02_ordenes.sql

-- ORDEN
CREATE TABLE IF NOT EXISTS orden (
    id_orden        SERIAL          PRIMARY KEY,
    id_cliente      INT             NOT NULL,
    id_usuario      INT,
    fecha_orden     TIMESTAMP       NOT NULL DEFAULT NOW(),
    estado          VARCHAR(20)     NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE','CONFIRMADO','EN_PREPARACION','ENVIADO','ENTREGADO','CANCELADO')),
    notas           TEXT,
    total           NUMERIC(12,2)   NOT NULL DEFAULT 0,
    CONSTRAINT fk_orden_cliente  FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    CONSTRAINT fk_orden_usuario  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- DETALLE_ORDEN
CREATE TABLE IF NOT EXISTS detalle_orden (
    id_detalle      SERIAL          PRIMARY KEY,
    id_orden        INT             NOT NULL,
    id_producto     INT             NOT NULL,
    id_bodega       INT,
    cantidad        NUMERIC(12,3)   NOT NULL,
    precio_unitario NUMERIC(10,2)   NOT NULL,
    subtotal        NUMERIC(12,2)   NOT NULL,
    CONSTRAINT fk_do_orden    FOREIGN KEY (id_orden)    REFERENCES orden(id_orden) ON DELETE CASCADE,
    CONSTRAINT fk_do_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    CONSTRAINT fk_do_bodega   FOREIGN KEY (id_bodega)   REFERENCES bodega(id_bodega)
);
