-- 08_orden_ligada_a_venta.sql
--
-- Las órdenes (pedidos que prepara bodega) dejan de nacer solas: ahora son el
-- "ticket de entrega" de una VENTA con entrega a domicilio. La venta es la que
-- descuenta stock, genera factura y, si es a crédito, la cuenta por cobrar;
-- la orden solo guarda a qué venta pertenece (orden.id_venta) y recorre el
-- flujo de bodega (CONFIRMADO -> EN_PREPARACION -> ENVIADO -> ENTREGADO).
--
-- Las órdenes anteriores a este cambio quedan con id_venta NULL (no se
-- modifican).
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/08_orden_ligada_a_venta.sql

ALTER TABLE orden
    ADD COLUMN IF NOT EXISTS id_venta INT UNIQUE REFERENCES venta(id_venta);
