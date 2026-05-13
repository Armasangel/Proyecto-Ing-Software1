--  init/01_schema.sql
--  Este archivo corre AUTOMÁTICAMENTE la primera vez que
--  Docker crea el contenedor de PostgreSQL.
--  Si la BD ya existe (volumen tienda_data), NO corre de nuevo.

-- CATEGORIA
CREATE TABLE categoria (
    id_categoria        SERIAL          PRIMARY KEY,
    nombre_categoria    VARCHAR(100)    NOT NULL,
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre_categoria)
);

-- MARCA
CREATE TABLE marca (
    id_marca        SERIAL          PRIMARY KEY,
    nombre_marca    VARCHAR(100)    NOT NULL,
    CONSTRAINT uq_marca_nombre UNIQUE (nombre_marca)
);

-- PROVEEDOR
CREATE TABLE proveedor (
    id_proveedor        SERIAL          PRIMARY KEY,
    nombre_proveedor    VARCHAR(150)    NOT NULL,
    nit_proveedor       VARCHAR(20)     NOT NULL,
    correo_contacto     VARCHAR(200),
    telefono            VARCHAR(20),
    estado_proveedor    BOOLEAN         NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_proveedor_nit UNIQUE (nit_proveedor)
);

-- PRODUCTO
CREATE TABLE producto (
    id_producto         SERIAL          PRIMARY KEY,
    codigo_producto     VARCHAR(50)     NOT NULL,
    nombre_producto     VARCHAR(200)    NOT NULL,
    precio_unitario     NUMERIC(10,2),
    precio_mayoreo      NUMERIC(10,2),
    unidad_medida       VARCHAR(50)     NOT NULL,
    estado_producto     BOOLEAN         NOT NULL DEFAULT TRUE,
    caducidad           BOOLEAN         NOT NULL DEFAULT FALSE,
    exento_iva          BOOLEAN         NOT NULL DEFAULT FALSE,
    id_categoria        INT             NOT NULL,
    id_marca            INT             NOT NULL,
    CONSTRAINT uq_producto_codigo    UNIQUE (codigo_producto),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria),
    CONSTRAINT fk_producto_marca     FOREIGN KEY (id_marca)     REFERENCES marca(id_marca)
);

-- PRODUCTO_PROVEEDOR
CREATE TABLE producto_proveedor (
    id_producto     INT NOT NULL,
    id_proveedor    INT NOT NULL,
    PRIMARY KEY (id_producto, id_proveedor),
    CONSTRAINT fk_pp_producto   FOREIGN KEY (id_producto)  REFERENCES producto(id_producto),
    CONSTRAINT fk_pp_proveedor  FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
);

-- USUARIO
CREATE TABLE usuario (
    id_usuario        SERIAL          PRIMARY KEY,
    nombre            VARCHAR(150)    NOT NULL,
    correo            VARCHAR(200)    NOT NULL,
    telefono          VARCHAR(20),
    contrasena_hash   VARCHAR(255)    NOT NULL,
    tipo_usuario      VARCHAR(20)     NOT NULL CHECK (tipo_usuario IN ('DUENO', 'EMPLEADO', 'COMPRADOR', 'COMPRADOR_MAYOR')),
    estado_usuario    BOOLEAN         NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_usuario_correo    UNIQUE (correo),
    CONSTRAINT uq_usuario_telefono  UNIQUE (telefono)
);

-- BODEGA
CREATE TABLE bodega (
    id_bodega       SERIAL          PRIMARY KEY,
    nombre_bodega   VARCHAR(100)    NOT NULL,
    ubicacion       VARCHAR(255)
);

-- BODEGA_PRODUCTO (inventario)
CREATE TABLE bodega_producto (
    id_bodega               INT             NOT NULL,
    id_producto             INT             NOT NULL,
    cantidad_disponible     NUMERIC(12,3)   NOT NULL DEFAULT 0,
    stock_minimo            NUMERIC(12,3)   NOT NULL DEFAULT 0,
    ultima_actualizacion    TIMESTAMP       NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_bodega, id_producto),
    CONSTRAINT fk_bp_bodega   FOREIGN KEY (id_bodega)   REFERENCES bodega(id_bodega),
    CONSTRAINT fk_bp_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

-- KARDEX
CREATE TABLE kardex (
    id_kardex           SERIAL          PRIMARY KEY,
    id_bodega           INT             NOT NULL,
    id_producto         INT             NOT NULL,
    fecha_movimiento    TIMESTAMP       NOT NULL DEFAULT NOW(),
    tipo_movimiento     VARCHAR(20)     NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad            NUMERIC(12,3)   NOT NULL,
    descripcion         VARCHAR(255),
    CONSTRAINT fk_kardex_bp FOREIGN KEY (id_bodega, id_producto)
        REFERENCES bodega_producto(id_bodega, id_producto)
);

-- VENTA
CREATE TABLE venta (
    id_venta            SERIAL          PRIMARY KEY,
    id_usuario          INT             NOT NULL,
    id_empleado         INT,
    fecha_venta         TIMESTAMP       NOT NULL DEFAULT NOW(),
    estado_venta        VARCHAR(20)     NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado_venta IN ('PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'PAGADO', 'CANCELADO')),
    tipo_venta          VARCHAR(20)     NOT NULL CHECK (tipo_venta IN ('MINORISTA', 'MAYORISTA')),
    tipo_entrega        VARCHAR(20)     NOT NULL CHECK (tipo_entrega IN ('EN_TIENDA', 'DOMICILIO')),
    direccion_entrega   VARCHAR(255),
    enlinea             BOOLEAN         NOT NULL DEFAULT FALSE,
    total               NUMERIC(12,2)   NOT NULL DEFAULT 0,
    fecha_limite_pago   DATE,
    CONSTRAINT fk_venta_usuario   FOREIGN KEY (id_usuario)  REFERENCES usuario(id_usuario),
    CONSTRAINT fk_venta_empleado  FOREIGN KEY (id_empleado) REFERENCES usuario(id_usuario),
    CONSTRAINT chk_direccion      CHECK (tipo_entrega = 'EN_TIENDA' OR direccion_entrega IS NOT NULL)
);

-- DETALLE_VENTA
CREATE TABLE detalle_venta (
    id_detalle_venta    SERIAL          PRIMARY KEY,
    id_venta            INT             NOT NULL,
    id_producto         INT             NOT NULL,
    cantidad            NUMERIC(12,3)   NOT NULL,
    precio_unitario     NUMERIC(10,2)   NOT NULL,
    subtotal            NUMERIC(12,2)   NOT NULL,
    CONSTRAINT fk_dv_venta    FOREIGN KEY (id_venta)    REFERENCES venta(id_venta),
    CONSTRAINT fk_dv_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

-- PAGO
CREATE TABLE pago (
    id_pago     SERIAL          PRIMARY KEY,
    id_venta    INT             NOT NULL,
    fecha_pago  TIMESTAMP       NOT NULL DEFAULT NOW(),
    monto       NUMERIC(12,2)   NOT NULL,
    metodo      VARCHAR(20)     NOT NULL CHECK (metodo IN ('TARJETA', 'EFECTIVO', 'TRANSFERENCIA')),
    CONSTRAINT fk_pago_venta FOREIGN KEY (id_venta) REFERENCES venta(id_venta)
);

-- FACTURA
CREATE TABLE factura (
    id_factura      SERIAL          PRIMARY KEY,
    id_venta        INT             NOT NULL,
    numero_factura  VARCHAR(50)     NOT NULL,
    nombre_cliente  VARCHAR(150),
    nit_cliente     VARCHAR(20)     NOT NULL DEFAULT 'CF',
    total_factura   NUMERIC(12,2)   NOT NULL,
    CONSTRAINT uq_factura_numero UNIQUE (numero_factura),
    CONSTRAINT uq_factura_venta  UNIQUE (id_venta),
    CONSTRAINT fk_factura_venta  FOREIGN KEY (id_venta) REFERENCES venta(id_venta)
);

--  VISTA: deudores en tiempo real (sin tabla redundante)
CREATE VIEW v_deudores AS
SELECT
    v.id_venta,
    u.nombre                                AS nombre_cliente,
    u.correo,
    v.fecha_venta,
    v.fecha_limite_pago,
    v.total                                 AS total_venta,
    COALESCE(SUM(p.monto), 0)              AS total_pagado,
    v.total - COALESCE(SUM(p.monto), 0)   AS deuda_pendiente
FROM venta v
JOIN usuario u ON u.id_usuario = v.id_usuario
LEFT JOIN pago p ON p.id_venta = v.id_venta
WHERE v.estado_venta != 'PAGADO'
GROUP BY v.id_venta, u.nombre, u.correo, v.fecha_venta, v.fecha_limite_pago, v.total
HAVING v.total - COALESCE(SUM(p.monto), 0) > 0;

--  DATOS DE PRUEBA
INSERT INTO categoria (nombre_categoria) VALUES ('Abarrotes'), ('Lácteos'), ('Bebidas');
INSERT INTO marca (nombre_marca) VALUES ('Genérico'), ('La Mariposa'), ('Dos Pinos');
INSERT INTO bodega (nombre_bodega, ubicacion) VALUES ('Bodega Principal', 'Zona 1, Guatemala');

-- Contraseña de prueba (los tres usuarios): password123
INSERT INTO usuario (nombre, correo, telefono, contrasena_hash, tipo_usuario) VALUES
  ('Admin Dueño',    'dueno@tienda.com',    '50201234567', '$2b$10$fHirMqOPU1ORDgfFCxkfG.PetZXrQ9XEjVwKgAfM4BnmIVDXL7cUm', 'DUENO'),
  ('Carlos Empleado','empleado@tienda.com', '50207654321', '$2b$10$fHirMqOPU1ORDgfFCxkfG.PetZXrQ9XEjVwKgAfM4BnmIVDXL7cUm', 'EMPLEADO'),
  ('Maria Comprador','maria@gmail.com',     '50209876543', '$2b$10$fHirMqOPU1ORDgfFCxkfG.PetZXrQ9XEjVwKgAfM4BnmIVDXL7cUm', 'COMPRADOR'),
  ('Pedro Mayorista','pedro@gmail.com',     '50205555555', '$2b$10$fHirMqOPU1ORDgfFCxkfG.PetZXrQ9XEjVwKgAfM4BnmIVDXL7cUm', 'COMPRADOR_MAYOR');

INSERT INTO producto (codigo_producto, nombre_producto, precio_unitario, precio_mayoreo, unidad_medida, id_categoria, id_marca)
VALUES
  ('ARR-001', 'Arroz 1 libra',    4.50,  3.75, 'libra',  1, 1),
  ('ACE-001', 'Aceite 1 litro',  18.00, 15.00, 'litro',  1, 2),
  ('LEC-001', 'Leche entera 1L', 12.50, 10.00, 'litro',  2, 3);

INSERT INTO bodega_producto (id_bodega, id_producto, cantidad_disponible, stock_minimo)
VALUES (1, 1, 150, 20), (1, 2, 80, 10), (1, 3, 45, 15);