-- Compra contable y recepción física son operaciones independientes.
BEGIN;
CREATE TABLE IF NOT EXISTS compra (
  id_compra SERIAL PRIMARY KEY,
  clave UUID NOT NULL UNIQUE,
  ticket VARCHAR(50) NOT NULL UNIQUE,
  id_proveedor INT NOT NULL REFERENCES proveedor(id_proveedor),
  proveedor_datos JSONB NOT NULL,
  numero_factura VARCHAR(80) NOT NULL,
  fecha_compra DATE NOT NULL,
  condicion_pago VARCHAR(10) NOT NULL CHECK (condicion_pago IN ('CONTADO','CREDITO')),
  fecha_vencimiento DATE,
  forma_pago VARCHAR(50) NOT NULL,
  referencia_pago VARCHAR(120),
  notas TEXT,
  direccion_entrega VARCHAR(255),
  tolerancia_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tolerancia_porcentaje BETWEEN 0 AND 100),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  impuestos NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
  transporte NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (transporte >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','RECUENTO','REVISION','RECIBIDA')),
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_proveedor, numero_factura),
  CHECK ((condicion_pago = 'CONTADO' AND fecha_vencimiento IS NULL) OR
         (condicion_pago = 'CREDITO' AND fecha_vencimiento >= fecha_compra))
);
CREATE TABLE IF NOT EXISTS compra_detalle (
  id_detalle SERIAL PRIMARY KEY,
  id_compra INT NOT NULL REFERENCES compra(id_compra),
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  nombre_producto VARCHAR(200) NOT NULL,
  unidad_base VARCHAR(50) NOT NULL,
  id_presentacion INT REFERENCES presentacion_producto(id_presentacion),
  nombre_presentacion VARCHAR(100),
  factor_conversion NUMERIC(12,3) NOT NULL CHECK (factor_conversion > 0),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  cantidad_base NUMERIC(12,3) NOT NULL CHECK (cantidad_base > 0),
  costo NUMERIC(12,2) NOT NULL CHECK (costo > 0),
  costo_base NUMERIC(14,6) NOT NULL CHECK (costo_base > 0),
  costo_anterior NUMERIC(14,6),
  venta_anterior NUMERIC(10,2),
  mayoreo_anterior NUMERIC(10,2),
  venta_nueva NUMERIC(10,2),
  mayoreo_nuevo NUMERIC(10,2),
  actualizar_precio BOOLEAN NOT NULL,
  lote VARCHAR(100),
  fecha_caducidad DATE,
  UNIQUE(id_compra, id_producto)
);
CREATE INDEX IF NOT EXISTS compra_detalle_producto_idx ON compra_detalle(id_producto, id_compra);
CREATE TABLE IF NOT EXISTS compra_pago (
  id_pago SERIAL PRIMARY KEY,
  clave UUID NOT NULL UNIQUE,
  id_compra INT NOT NULL REFERENCES compra(id_compra),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  forma_pago VARCHAR(50) NOT NULL,
  referencia VARCHAR(120),
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS compra_recepcion (
  id_recepcion SERIAL PRIMARY KEY,
  clave UUID NOT NULL UNIQUE,
  id_compra INT NOT NULL REFERENCES compra(id_compra),
  id_bodega INT NOT NULL REFERENCES bodega(id_bodega),
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  estado VARCHAR(25) NOT NULL CHECK (estado IN ('RECONTAR','PENDIENTE_DUENO','APLICADA','RECHAZADA')),
  intentos INT NOT NULL DEFAULT 1 CHECK (intentos BETWEEN 1 AND 2),
  primer_conteo JSONB NOT NULL,
  conteo JSONB NOT NULL,
  constancia TEXT,
  resolucion TEXT,
  id_dueno INT REFERENCES usuario(id_usuario),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aplicada_en TIMESTAMPTZ
);
-- Solo una recepción activa por ticket; una rechazada conserva su auditoría.
CREATE UNIQUE INDEX IF NOT EXISTS compra_recepcion_activa_idx ON compra_recepcion(id_compra) WHERE estado <> 'RECHAZADA';
CREATE TABLE IF NOT EXISTS compra_aviso (
  id_aviso SERIAL PRIMARY KEY,
  id_compra INT NOT NULL REFERENCES compra(id_compra),
  mensaje TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION proteger_unidad_compra_pendiente()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unidad_medida IS DISTINCT FROM OLD.unidad_medida AND EXISTS (
    SELECT 1 FROM compra_detalle d JOIN compra c USING(id_compra)
    WHERE d.id_producto=OLD.id_producto AND c.estado <> 'RECIBIDA'
  ) THEN
    RAISE EXCEPTION 'El producto tiene compras pendientes de recepción; conserva su unidad base.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_unidad_compra_pendiente ON producto;
CREATE TRIGGER trg_unidad_compra_pendiente BEFORE UPDATE OF unidad_medida ON producto
FOR EACH ROW EXECUTE FUNCTION proteger_unidad_compra_pendiente();
COMMIT;
