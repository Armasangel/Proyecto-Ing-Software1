-- 10_consumidor_final.sql
--
-- Cliente genérico "Consumidor Final": registro predeterminado para ventas
-- a personas que no quieren registrarse (típico mostrador/caja).
--
--   * cliente.es_consumidor_final: marca al único cliente genérico. No se
--     distingue por nombre para que un renombre accidental no lo pierda.
--   * No se le puede asignar límite de deuda (PATCH /api/clientes/:id lo
--     rechaza) y las ventas a crédito con este cliente se rechazan en
--     POST /api/ventas: un cliente anónimo no es cobrable.
--   * nit_cliente queda en 'CF' (Consumidor Final) y sin correo/teléfono.
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/10_consumidor_final.sql

ALTER TABLE cliente
    ADD COLUMN IF NOT EXISTS es_consumidor_final BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed idempotente: solo se crea si todavía no existe un Consumidor Final.
INSERT INTO cliente (nombre, correo, telefono, tipo_cliente, nit_cliente, es_consumidor_final)
SELECT 'Consumidor Final', NULL, NULL, 'MINORISTA', 'CF', TRUE
WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE es_consumidor_final = TRUE);
