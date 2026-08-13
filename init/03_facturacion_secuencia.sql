-- init/03_factura_secuencia.sql
--
-- FIX: el número de factura se generaba en JavaScript con `FACT-${Date.now()}`
-- (milisegundos desde época). Dos facturas creadas en el mismo milisegundo
-- (posible con tráfico concurrente) podían chocar, y además no es un
-- correlativo real como exige la facturación.
--
-- Esta secuencia le delega la generación del número a Postgres, que
-- garantiza que nextval() nunca devuelve el mismo valor dos veces,
-- sin necesidad de locks manuales.

CREATE SEQUENCE IF NOT EXISTS factura_numero_seq
    START WITH 1
    INCREMENT BY 1;