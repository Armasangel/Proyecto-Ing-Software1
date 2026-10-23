import { randomUUID } from "crypto";
import { transaccion } from "@/lib/compras-transaccion";
export { recibirCompra, recontarCompra, resolverCompra } from "@/lib/recepciones-service";
import { normalizarUnidad } from "@/lib/presentaciones";
import { calcularImpuestos, costoUnitarioCompra, clave, CompraError, fecha, identificador, numero, redondear, texto } from "@/lib/compras";

type Datos = Record<string, unknown>;
function lineas(valor: unknown): Datos[] {
  if (!Array.isArray(valor) || !valor.length || valor.length > 100 || valor.some(v => !v || typeof v !== "object" || Array.isArray(v)))
    throw new CompraError("Agrega entre 1 y 100 productos.");
  const ids = valor.map(l => identificador(l.id_producto));
  if (new Set(ids).size !== ids.length) throw new CompraError("Agrupa cada producto en una sola línea.");
  return [...valor].sort((a, b) => Number(a.id_producto) - Number(b.id_producto));
}

export async function crearCompra(body: Datos, idUsuario: number) {
  const operacion = clave(body.clave);
  return transaccion(async client => {
    // Serializa reintentos incluso antes de existir la cabecera.
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [operacion]);
    const previa = await client.query(`SELECT id_compra, ticket FROM compra WHERE clave = $1`, [operacion]);
    if (previa.rowCount) return previa.rows[0];
    const proveedor = await client.query(`SELECT id_proveedor, nombre_proveedor, nit_proveedor, correo_contacto, telefono
      FROM proveedor WHERE id_proveedor = $1 AND estado_proveedor = TRUE FOR SHARE`, [identificador(body.id_proveedor)]);
    if (!proveedor.rowCount) throw new CompraError("Selecciona un proveedor activo.");
    const numeroFactura = texto(body.numero_factura, "Número de factura", 80, true);
    const fechaCompra = fecha(body.fecha_compra, "Fecha de compra")!;
    const condicion = body.condicion_pago;
    if (condicion !== "CONTADO" && condicion !== "CREDITO") throw new CompraError("Condición de pago inválida.");
    const vence = condicion === "CREDITO" ? fecha(body.fecha_vencimiento, "Fecha de vencimiento") : null;
    if (vence && vence < fechaCompra) throw new CompraError("El vencimiento no puede ser anterior a la compra.");
    const forma = texto(body.forma_pago, "Forma de pago", 50, true);
    const referencia = texto(body.referencia_pago, "Referencia de pago", 120);
    const tolerancia = numero(body.tolerancia_porcentaje, "Tolerancia", 0, 100, 2);
    const descuento = numero(body.descuento, "Descuento", 0, 999999999, 2);
    if (!Array.isArray(body.impuestos_detalle) || body.impuestos_detalle.length > 20)
      throw new CompraError("Indica los impuestos porcentuales de la compra.");
    const tasas = body.impuestos_detalle.map((t:Datos)=>({nombre:texto(t?.nombre,"Nombre del impuesto",80,true),
      porcentaje:numero(t?.porcentaje,"Porcentaje del impuesto",0,100,2)}));
    const transporte = numero(body.transporte, "Transporte", 0, 999999999, 2);
    const detalle = [];
    let subtotal = 0;
    for (const linea of lineas(body.productos)) {
      const id = identificador(linea.id_producto);
      const prod = await client.query(`SELECT id_producto, nombre_producto, unidad_medida, precio_unitario, precio_mayoreo
        FROM producto WHERE id_producto = $1 AND estado_producto = TRUE FOR UPDATE`, [id]);
      if (!prod.rowCount) throw new CompraError("Producto no disponible.");
      const p = prod.rows[0];
      let factor = 1; let nombrePres = null;
      const idPres = linea.id_presentacion == null ? null : identificador(linea.id_presentacion);
      if (idPres) {
        const pres = await client.query(`SELECT nombre_presentacion, factor_conversion FROM presentacion_producto
          WHERE id_presentacion = $1 AND id_producto = $2 AND unidad_base = $3 AND estado_presentacion = TRUE FOR SHARE`, [idPres, id, normalizarUnidad(p.unidad_medida)]);
        if (!pres.rowCount) throw new CompraError("Presentación no disponible para la unidad del producto.");
        factor = Number(pres.rows[0].factor_conversion); nombrePres = pres.rows[0].nombre_presentacion;
      }
      const cantidad = numero(linea.cantidad, "Cantidad", 0.001);
      const base = numero(redondear(cantidad * factor, 3), "Cantidad base", 0.001);
      const costo = numero(linea.costo, "Costo por presentación", 0.01, 999999999, 2);
      const anterior = await client.query(`SELECT costo_base FROM compra_detalle WHERE id_producto = $1 AND unidad_base = $2
        ORDER BY id_detalle DESC LIMIT 1`, [id, p.unidad_medida]);
      if (typeof linea.actualizar_precio !== "boolean") throw new CompraError("Indica si deseas conservar o cambiar los precios.");
      const actualizar = linea.actualizar_precio;
      const venta = actualizar ? numero(linea.venta_nueva, "Precio de venta", 0.01, 99999999, 2) : p.precio_unitario;
      const mayoreo = actualizar ? numero(linea.mayoreo_nuevo, "Precio de mayoreo", 0.01, 99999999, 2) : p.precio_mayoreo;
      // La comparativa aprobada no puede quedar obsoleta por otra edición.
      if (String(linea.venta_anterior ?? "") !== String(p.precio_unitario ?? "") && Number(linea.venta_anterior) !== Number(p.precio_unitario) ||
          String(linea.mayoreo_anterior ?? "") !== String(p.precio_mayoreo ?? "") && Number(linea.mayoreo_anterior) !== Number(p.precio_mayoreo))
        throw new CompraError("Los precios cambiaron. Actualiza la comparativa antes de guardar.", 409);
      const importe = redondear(cantidad * costo);
      if (importe < 0.01) throw new CompraError("El importe de cada producto debe ser al menos Q 0.01.");
      subtotal = redondear(subtotal + importe);
      detalle.push({ id, p, idPres, nombrePres, factor, cantidad, base, costo, importe,
        costoAnterior: anterior.rows[0]?.costo_base ?? null, venta, mayoreo, actualizar,
        lote: texto(linea.lote, "Lote", 100), caducidad: fecha(linea.fecha_caducidad, "Caducidad", true) });
    }
    if (descuento > subtotal) throw new CompraError("El descuento supera el subtotal.");
    const impuestosDetalle = calcularImpuestos(subtotal,descuento,tasas);
    const impuestos = redondear(impuestosDetalle.reduce((s,t)=>s+t.monto,0));
    const total = numero(redondear(subtotal - descuento + impuestos + transporte), "Total", 0.01, 999999999, 2);
    const anticipo = condicion === "CONTADO" ? total : numero(body.anticipo, "Anticipo", 0, total, 2);
    const ticket = `REC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const cab = await client.query(`INSERT INTO compra (clave,ticket,id_proveedor,proveedor_datos,numero_factura,fecha_compra,
      condicion_pago,fecha_vencimiento,forma_pago,referencia_pago,notas,direccion_entrega,tolerancia_porcentaje,subtotal,descuento,impuestos,transporte,total,id_usuario,impuestos_detalle)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id_compra, ticket`,
    [operacion, ticket, proveedor.rows[0].id_proveedor, JSON.stringify(proveedor.rows[0]), numeroFactura, fechaCompra,
      condicion, vence, forma, referencia, texto(body.notas, "Notas", 4000), texto(body.direccion_entrega, "Dirección de entrega", 255),
      tolerancia, subtotal, descuento, impuestos, transporte, total, idUsuario,JSON.stringify(impuestosDetalle)]);
    const idCompra = cab.rows[0].id_compra;
    for (const l of detalle) {
      const costoBase = numero(costoUnitarioCompra(l.cantidad,l.costo,l.factor,total,subtotal),"Costo por unidad",0.000001,99999999,6);
      await client.query(`INSERT INTO compra_detalle (id_compra,id_producto,nombre_producto,unidad_base,id_presentacion,nombre_presentacion,
        factor_conversion,cantidad,cantidad_base,costo,costo_base,costo_anterior,venta_anterior,mayoreo_anterior,venta_nueva,mayoreo_nuevo,actualizar_precio,lote,fecha_caducidad)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [idCompra,l.id,l.p.nombre_producto,l.p.unidad_medida,l.idPres,l.nombrePres,l.factor,l.cantidad,l.base,l.costo,costoBase,l.costoAnterior,
        l.p.precio_unitario,l.p.precio_mayoreo,l.venta,l.mayoreo,l.actualizar,l.lote,l.caducidad]);
      await client.query(`INSERT INTO producto_proveedor (id_producto,id_proveedor) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [l.id,proveedor.rows[0].id_proveedor]);
      if (l.actualizar) await client.query(`UPDATE producto SET precio_unitario=$1, precio_mayoreo=$2 WHERE id_producto=$3`, [l.venta,l.mayoreo,l.id]);
    }
    if (anticipo > 0) await client.query(`INSERT INTO compra_pago (clave,id_compra,monto,fecha,forma_pago,referencia,id_usuario)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(),idCompra,anticipo,fechaCompra,forma,referencia,idUsuario]);
    return cab.rows[0];
  });
}

export async function pagarCompra(id: number, body: Datos, idDueno: number) {
  const operacion = clave(body.clave);
  return transaccion(async client => {
    const cab = await client.query(`SELECT total FROM compra WHERE id_compra=$1 FOR UPDATE`,[id]);
    if (!cab.rowCount) throw new CompraError("Compra no disponible.",404);
    const previa = await client.query(`SELECT id_compra FROM compra_pago WHERE clave=$1`,[operacion]);
    if (previa.rowCount) {
      if (previa.rows[0].id_compra !== id) throw new CompraError("Clave de pago ya utilizada.",409);
      return { mensaje:"Pago registrado." };
    }
    const pagos = await client.query(`SELECT COALESCE(SUM(monto),0) AS pagado FROM compra_pago WHERE id_compra=$1`,[id]);
    const saldo = redondear(Number(cab.rows[0].total)-Number(pagos.rows[0].pagado));
    const monto = numero(body.monto,"Monto",0.01,saldo,2);
    await client.query(`INSERT INTO compra_pago (clave,id_compra,monto,fecha,forma_pago,referencia,id_usuario)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,[operacion,id,monto,fecha(body.fecha,"Fecha de pago"),texto(body.forma_pago,"Forma de pago",50,true),texto(body.referencia,"Referencia",120),idDueno]);
    return { mensaje:"Pago registrado." };
  });
}
