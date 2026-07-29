--  init/02_deudas.sql
--  Sprint 5: módulo de deudas.
--  El dueño crea una deuda manualmente (ya no viene de una venta/pedido en línea),
--  especificando qué productos, cuánto se debe, quién debe y desde cuándo.
--
--  NOTA: los scripts de /init SOLO corren la primera vez que Docker crea el
--  volumen de Postgres. Si tu base de datos ya existía (volumen postgres_data
--  ya creado), este archivo NO se va a ejecutar solo. Opciones:
--    a) `docker compose down -v` y `docker compose up --build` (borra datos y recrea todo)
--    b) Ejecutar el contenido de este archivo a mano, por ejemplo:
--       docker compose exec -T db psql -U dsm_user -d deposito_san_miguel < init/02_deudas.sql

-- DEUDA (cabecera)
CREATE TABLE deuda (
    id_deuda            SERIAL          PRIMARY KEY,
    nombre_deudor       VARCHAR(150)    NOT NULL,
    telefono_deudor     VARCHAR(20),
    fecha_inicio        DATE            NOT NULL DEFAULT CURRENT_DATE,
    monto_total         NUMERIC(12,2)   NOT NULL DEFAULT 0,
    estado_deuda        VARCHAR(20)     NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado_deuda IN ('PENDIENTE', 'PAGADA')),
    id_usuario          INT             NOT NULL,
    fecha_creacion       TIMESTAMP       NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_deuda_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- DEUDA_PRODUCTO (detalle: qué productos componen la deuda)
CREATE TABLE deuda_producto (
    id_deuda            INT             NOT NULL,
    id_producto         INT             NOT NULL,
    cantidad             NUMERIC(12,3)   NOT NULL,
    precio_unitario      NUMERIC(10,2)   NOT NULL,  -- snapshot del precio al crear la deuda
    subtotal             NUMERIC(12,2)   NOT NULL,
    PRIMARY KEY (id_deuda, id_producto),
    CONSTRAINT fk_dp_deuda    FOREIGN KEY (id_deuda)    REFERENCES deuda(id_deuda) ON DELETE CASCADE,
    CONSTRAINT fk_dp_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE INDEX idx_deuda_estado ON deuda(estado_deuda);
