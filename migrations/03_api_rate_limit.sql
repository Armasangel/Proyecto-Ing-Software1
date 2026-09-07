-- 003_api_rate_limit.sql
-- Contador genérico de rate limiting (ventana fija), usado primero en
-- /api/usuarios y reutilizable para cualquier endpoint futuro.
-- Segura de correr más de una vez (usa IF NOT EXISTS).
--
-- Cómo correrla:
--   psql -U <usuario> -d <basedatos> -f migrations/003_api_rate_limit.sql

CREATE TABLE IF NOT EXISTS api_rate_limit (
    clave           VARCHAR(150)    PRIMARY KEY,
    contador        INT             NOT NULL DEFAULT 0,
    ventana_inicio  TIMESTAMP       NOT NULL DEFAULT NOW()
);
