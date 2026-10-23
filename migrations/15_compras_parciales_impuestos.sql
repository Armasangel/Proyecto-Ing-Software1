BEGIN;
ALTER TABLE compra ADD COLUMN IF NOT EXISTS impuestos_detalle JSONB NOT NULL DEFAULT '[]';
ALTER TABLE compra DROP CONSTRAINT IF EXISTS compra_estado_check;
ALTER TABLE compra ADD CONSTRAINT compra_estado_check CHECK (estado IN ('PENDIENTE','PARCIAL','RECUENTO','REVISION','RECIBIDA'));
ALTER TABLE compra_recepcion ADD COLUMN IF NOT EXISTS parcial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE compra_recepcion ADD COLUMN IF NOT EXISTS esperado JSONB NOT NULL DEFAULT '[]';
ALTER TABLE compra_recepcion ADD COLUMN IF NOT EXISTS productos_cerrados INT[] NOT NULL DEFAULT '{}';
-- Conserva lo ya ingresado. Las constancias anteriores reservan solo los
-- productos que realmente se contaron, sin bloquear el resto de la factura.
UPDATE compra_recepcion r SET
  esperado=COALESCE((SELECT jsonb_agg(jsonb_build_object('id_producto',d.id_producto,'cantidad_base',d.cantidad_base,'unidad_base',d.unidad_base,'tolerancia_base',d.cantidad_base))
    FROM compra_detalle d WHERE d.id_compra=r.id_compra AND EXISTS
      (SELECT 1 FROM jsonb_array_elements(r.conteo) x WHERE (x->>'id_producto')::int=d.id_producto)), '[]'),
  productos_cerrados=CASE WHEN r.estado='APLICADA' THEN ARRAY(SELECT d.id_producto FROM compra_detalle d WHERE d.id_compra=r.id_compra AND EXISTS
      (SELECT 1 FROM jsonb_array_elements(r.conteo) x WHERE (x->>'id_producto')::int=d.id_producto)) ELSE '{}'::int[] END
WHERE r.esperado='[]'::jsonb OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r.esperado) e WHERE e ? 'tolerancia_base');
-- Si una entrada antigua omitió otros productos, permite recibirlos ahora,
-- sin volver a ingresar ni alterar el stock que ya se había aceptado.
UPDATE compra c SET estado='PARCIAL' WHERE c.estado='RECIBIDA' AND EXISTS (
  SELECT 1 FROM compra_detalle d WHERE d.id_compra=c.id_compra AND NOT EXISTS (
    SELECT 1 FROM compra_recepcion r WHERE r.id_compra=c.id_compra AND r.estado='APLICADA' AND d.id_producto=ANY(r.productos_cerrados)
  )
);
DROP INDEX IF EXISTS compra_recepcion_activa_idx;
CREATE INDEX IF NOT EXISTS compra_recepcion_compra_idx ON compra_recepcion(id_compra,estado);
COMMIT;
