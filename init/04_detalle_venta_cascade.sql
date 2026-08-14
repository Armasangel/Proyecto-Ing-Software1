-- init/04_detalle_venta_cascade.sql
--
-- FEATURE: al borrar una venta, sus líneas de detalle_venta se borran
-- automáticamente en vez de quedar huérfanas o bloquear el DELETE.
--
-- Postgres no permite "ALTER CONSTRAINT ... ON DELETE CASCADE" directo:
-- hay que borrar la constraint vieja y crearla de nuevo con la opción.

ALTER TABLE detalle_venta
    DROP CONSTRAINT fk_dv_venta;

ALTER TABLE detalle_venta
    ADD CONSTRAINT fk_dv_venta
    FOREIGN KEY (id_venta) REFERENCES venta(id_venta)
    ON DELETE CASCADE;