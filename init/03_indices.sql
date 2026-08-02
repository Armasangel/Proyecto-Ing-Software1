--  init/03_indices.sql
--  Feature: índices en venta, detalle_venta y kardex para agilizar consultas.
--  Diseñados según los patrones de WHERE/JOIN/ORDER BY reales del código:
--    - app/api/gestion-inventario/kardex/route.ts (filtro por bodega+producto+tipo+fecha, orden por fecha)
--    - lib/historial-ventas.ts (filtro por fecha/cliente/total, EXISTS sobre detalle_venta por id_venta+id_producto)
--
--  NOTA: los scripts de /init SOLO corren la primera vez que Docker crea el
--  volumen de Postgres. Si tu base de datos ya existía (volumen postgres_data
--  ya creado), este archivo NO se va a ejecutar solo. Opciones:
--    a) `docker compose down -v` y `docker compose up --build` (borra datos y recrea todo)
--    b) Ejecutar el contenido de este archivo a mano, por ejemplo:
--       docker compose exec -T db psql -U dsm_user -d deposito_san_miguel < init/03_indices.sql

-- KARDEX
-- Calza con el filtro id_bodega + id_producto + ORDER BY fecha_movimiento DESC
-- del endpoint GET /api/gestion-inventario/kardex.
CREATE INDEX IF NOT EXISTS idx_kardex_bodega_producto_fecha
    ON kardex (id_bodega, id_producto, fecha_movimiento DESC);

-- Calza con el filtro por tipo_movimiento combinado con rango de fecha.
CREATE INDEX IF NOT EXISTS idx_kardex_tipo_fecha
    ON kardex (tipo_movimiento, fecha_movimiento DESC);

-- VENTA
-- Historial de ventas se ordena y filtra por fecha_venta (periodos: day/week/month/year).
CREATE INDEX IF NOT EXISTS idx_venta_fecha
    ON venta (fecha_venta DESC);

-- Filtro por id_cliente en historial-ventas.ts.
CREATE INDEX IF NOT EXISTS idx_venta_cliente
    ON venta (id_cliente);

-- DETALLE_VENTA
-- El FK id_venta no tiene índice automático en Postgres; se usa constantemente
-- en EXISTS (dv.id_venta = v.id_venta AND dv.id_producto = $x) y en JOINs de reportes.
CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta_producto
    ON detalle_venta (id_venta, id_producto);

-- Búsquedas/reportes que filtran directo por producto (ej. ventas por producto,
-- filtro id_producto en historial-ventas.ts) sin pasar primero por id_venta.
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto
    ON detalle_venta (id_producto);