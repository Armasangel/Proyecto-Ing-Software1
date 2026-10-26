import type { PoolClient } from "pg";
import { transaccion } from "@/lib/compras-transaccion";
import { normalizarUnidad } from "@/lib/presentaciones";
import { clave, CompraError, compararRecepcion, identificador, numero, redondear, texto, type Conteo, type Esperado } from "@/lib/compras";

type Datos=Record<string,unknown>;
type Usuario={id_usuario:number;tipo_usuario:string;id_bodega?:number|null};
type Recepcion={id_recepcion:number;id_compra:number;id_bodega:number;id_usuario:number;estado:string;conteo:Conteo[];esperado:Esperado[];parcial:boolean;productos_cerrados:number[]};

async function normalizarConteo(client:PoolClient, productos:unknown):Promise<Conteo[]> {
  if(!Array.isArray(productos)||!productos.length||productos.length>100)throw new CompraError("Agrega entre 1 y 100 productos.");
  const result:Conteo[]=[];
  for(const l of [...productos].sort((a,b)=>Number(a?.id_producto)-Number(b?.id_producto))) {
    const id=identificador(l?.id_producto);
    if(result.some(c=>c.id_producto===id))throw new CompraError("Agrupa cada producto en una sola línea.");
    const p=await client.query(`SELECT unidad_medida FROM producto WHERE id_producto=$1 FOR SHARE`,[id]);
    if(!p.rowCount)throw new CompraError("Producto no disponible.");
    const unidad=p.rows[0].unidad_medida;
    const idPres=l.id_presentacion==null?null:identificador(l.id_presentacion);
    let factor=1;let nombre=null;
    if(idPres) {
      const pres=await client.query(`SELECT nombre_presentacion,factor_conversion FROM presentacion_producto
        WHERE id_presentacion=$1 AND id_producto=$2 AND unidad_base=$3 AND estado_presentacion=TRUE FOR SHARE`,[idPres,id,normalizarUnidad(unidad)]);
      if(!pres.rowCount)throw new CompraError("Presentación no disponible.");
      factor=Number(pres.rows[0].factor_conversion);nombre=pres.rows[0].nombre_presentacion;
    }
    const cantidad=numero(l.cantidad,"Cantidad recibida",0);
    result.push({id_producto:id,cantidad,id_presentacion:idPres,nombre_presentacion:nombre,factor_conversion:factor,
      cantidad_base:numero(redondear(cantidad*factor,3),"Cantidad base",0),unidad_base:unidad});
  }
  return result;
}

async function saldoRecepcion(client:PoolClient,idCompra:number) {
  const detalle=await client.query<Esperado>(`SELECT id_producto,cantidad_base,unidad_base FROM compra_detalle WHERE id_compra=$1`,[idCompra]);
  const historial=await client.query<Recepcion>(`SELECT * FROM compra_recepcion WHERE id_compra=$1`,[idCompra]);
  const cerrados=new Set(historial.rows.filter(r=>r.estado==='APLICADA').flatMap(r=>r.productos_cerrados));
  const reservados=new Set(historial.rows.filter(r=>['RECONTAR','PENDIENTE_DUENO'].includes(r.estado)).flatMap(r=>r.esperado.map(e=>e.id_producto)));
  const pendientes=detalle.rows.filter(d=>!cerrados.has(d.id_producto)).map(d=>({
    ...d,tolerancia_base:d.cantidad_base,cantidad_base:redondear(Math.max(0,Number(d.cantidad_base)-historial.rows
      .filter(r=>r.estado==='APLICADA').reduce((s,r)=>s+(r.conteo.find(l=>l.id_producto===d.id_producto)?.cantidad_base??0),0)),3),
  }));
  return {pendientes,reservados};
}

async function actualizarEstado(client:PoolClient,idCompra:number) {
  const {pendientes}=await saldoRecepcion(client,idCompra);
  const rec=await client.query<{estado:string}>(`SELECT estado FROM compra_recepcion WHERE id_compra=$1`,[idCompra]);
  const estado=!pendientes.length?'RECIBIDA':rec.rows.some(r=>r.estado==='PENDIENTE_DUENO')?'REVISION'
    :rec.rows.some(r=>r.estado==='RECONTAR')?'RECUENTO':rec.rows.some(r=>r.estado==='APLICADA')?'PARCIAL':'PENDIENTE';
  await client.query(`UPDATE compra SET estado=$2 WHERE id_compra=$1`,[idCompra,estado]);
}

function evaluar(esperado:Esperado[],conteo:Conteo[],tolerancia:number,parcial:boolean) {
  const c=compararRecepcion(esperado,conteo,tolerancia);
  const parcialValida=parcial&&conteo.some(l=>l.cantidad_base>0)&&esperado.every(e=>{
    const l=conteo.find(l=>l.id_producto===e.id_producto);
    return l&&l.unidad_base===e.unidad_base&&l.cantidad_base<=Number(e.cantidad_base)+Number(e.tolerancia_base??e.cantidad_base)*tolerancia/100+0.0000001;
  });
  return {...c,aceptable:c.aceptable||parcialValida};
}

async function aplicarStock(client:PoolClient,r:Recepcion,tolerancia:number,idDueno?:number) {
  for(const l of [...r.conteo].sort((a,b)=>a.id_producto-b.id_producto)) {
    if(l.cantidad_base===0)continue;
    const unidad=await client.query(`SELECT unidad_medida FROM producto WHERE id_producto=$1 FOR SHARE`,[l.id_producto]);
    if(unidad.rows[0]?.unidad_medida!==l.unidad_base)throw new CompraError("La unidad del producto cambió. Revisa la recepción.",409);
    await client.query(`INSERT INTO bodega_producto (id_bodega,id_producto,cantidad_disponible) VALUES ($1,$2,$3)
      ON CONFLICT (id_bodega,id_producto) DO UPDATE SET cantidad_disponible=bodega_producto.cantidad_disponible+EXCLUDED.cantidad_disponible,ultima_actualizacion=NOW()`,[r.id_bodega,l.id_producto,l.cantidad_base]);
    await client.query(`INSERT INTO kardex (id_bodega,id_producto,tipo_movimiento,cantidad,descripcion,id_usuario,id_presentacion,cantidad_presentacion,unidad_base)
      VALUES ($1,$2,'ENTRADA',$3,$4,$5,$6,$7,$8)`,[r.id_bodega,l.id_producto,l.cantidad_base,`Recepción #${r.id_recepcion}`,r.id_usuario,l.id_presentacion,l.id_presentacion?l.cantidad:null,l.unidad_base]);
  }
  const diferencias=compararRecepcion(r.esperado,r.conteo,tolerancia).diferencias;
  // Si indicó que llegará más, incluso un faltante pequeño sigue pendiente.
  const cerrados=diferencias.filter(d=>(d.dentro&&(!r.parcial||d.diferencia>=0))||!r.parcial||idDueno!=null).map(d=>d.id_producto);
  await client.query(`UPDATE compra_recepcion SET estado='APLICADA',aplicada_en=NOW(),id_dueno=$2,productos_cerrados=$3 WHERE id_recepcion=$1`,[r.id_recepcion,idDueno??null,cerrados]);
  await actualizarEstado(client,r.id_compra);
}

function respuesta(r:{id_recepcion:number;estado:string}) {
  return {id_recepcion:r.id_recepcion,estado:r.estado,mensaje:r.estado==='RECONTAR'
    ?'La cantidad no coincide. Cuenta nuevamente los productos de esta entrada. Si persiste, completa la constancia.'
    :r.estado==='PENDIENTE_DUENO'?'Constancia enviada al dueño. Esta entrada espera su autorización; puedes registrar otros productos.'
    :r.estado==='APLICADA'?'Entrada aceptada. Stock actualizado y dueño notificado. Puedes registrar otra entrega.'
    :'Recepción cerrada.'};
}

export async function recibirCompra(body:Datos,usuario:Usuario) {
  const operacion=clave(body.clave);
  if(body.parcial!==undefined&&typeof body.parcial!=='boolean')throw new CompraError("Indica si la entrega es parcial.");
  return transaccion(async client=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,[operacion]);
    const previa=await client.query<Recepcion>(`SELECT * FROM compra_recepcion WHERE clave=$1`,[operacion]);
    if(previa.rowCount) {
      if(previa.rows[0].id_usuario!==usuario.id_usuario)throw new CompraError("No autorizado.",403);
      return respuesta(previa.rows[0]);
    }
    const idBodega=identificador(usuario.tipo_usuario==='BODEGUERO'?usuario.id_bodega:body.id_bodega);
    if(!(await client.query(`SELECT 1 FROM bodega WHERE id_bodega=$1`,[idBodega])).rowCount)throw new CompraError("Bodega no disponible.");
    const conteo=await normalizarConteo(client,body.productos);
    const ticket=texto(body.ticket,"Ticket",50);
    const ids=conteo.map(l=>l.id_producto);
    // Aun con una constancia pendiente, los otros productos pueden recibirse.
    const candidatos=await client.query(`SELECT c.id_compra FROM compra c WHERE c.estado<>'RECIBIDA' AND ($1::text='' OR c.ticket=$1)
      AND NOT EXISTS (SELECT 1 FROM unnest($2::int[]) x(id) WHERE NOT EXISTS
        (SELECT 1 FROM compra_detalle d WHERE d.id_compra=c.id_compra AND d.id_producto=x.id))
      AND NOT EXISTS (SELECT 1 FROM compra_recepcion r WHERE r.id_compra=c.id_compra AND r.estado='APLICADA' AND r.productos_cerrados && $2::int[])
      AND NOT EXISTS (SELECT 1 FROM compra_recepcion r CROSS JOIN LATERAL jsonb_array_elements(r.esperado) e
        WHERE r.id_compra=c.id_compra AND r.estado IN ('RECONTAR','PENDIENTE_DUENO') AND (e->>'id_producto')::int=ANY($2::int[]))
      ORDER BY c.id_compra LIMIT 2`,[ticket,ids]);
    if(candidatos.rowCount!==1)throw new CompraError(candidatos.rowCount?'Hay varias entregas compatibles. Solicita el código del ticket al dueño.'
      :'No se pudo vincular la entrada. Verifica el ticket y si estos productos tienen un recuento pendiente.',409);
    const cab=await client.query(`SELECT * FROM compra WHERE id_compra=$1 FOR UPDATE`,[candidatos.rows[0].id_compra]);
    const c=cab.rows[0];
    const {pendientes,reservados}=await saldoRecepcion(client,c.id_compra);
    const esperado=pendientes.filter(e=>ids.includes(e.id_producto));
    if(esperado.length!==ids.length||ids.some(id=>reservados.has(id)))throw new CompraError("Estos productos ya fueron recibidos o tienen un recuento pendiente.",409);
    const parcial=body.parcial===true;
    const comparacion=evaluar(esperado,conteo,Number(c.tolerancia_porcentaje),parcial);
    const estado=comparacion.aceptable?'APLICADA':'RECONTAR';
    const rec=await client.query<Recepcion>(`INSERT INTO compra_recepcion (clave,id_compra,id_bodega,id_usuario,estado,primer_conteo,conteo,esperado,parcial)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING *`,[operacion,c.id_compra,idBodega,usuario.id_usuario,estado,JSON.stringify(conteo),JSON.stringify(esperado),parcial]);
    if(comparacion.aceptable)await aplicarStock(client,rec.rows[0],Number(c.tolerancia_porcentaje));
    else await actualizarEstado(client,c.id_compra);
    await client.query(`INSERT INTO compra_aviso (id_compra,mensaje) VALUES ($1,$2)`,[c.id_compra,comparacion.coincide
      ?'Entrada exacta de los productos capturados: stock actualizado.'
      :comparacion.aceptable?(parcial?'Entrega parcial registrada: stock real actualizado; queda saldo por recibir.':'Entrada con diferencia dentro de tolerancia: stock real actualizado.')
      :'Diferencia en una entrada: se solicitó segundo conteo. Los demás productos pueden seguir recibiéndose.']);
    return respuesta(rec.rows[0]);
  });
}

export async function recontarCompra(id:number,body:Datos,usuario:Usuario) {
  return transaccion(async client=>{
    const cab=await client.query(`SELECT id_compra FROM compra_recepcion WHERE id_recepcion=$1 AND id_usuario=$2`,[id,usuario.id_usuario]);
    if(!cab.rowCount)throw new CompraError("Recepción no disponible.",404);
    const compra=await client.query(`SELECT * FROM compra WHERE id_compra=$1 FOR UPDATE`,[cab.rows[0].id_compra]);
    const rec=await client.query<Recepcion>(`SELECT * FROM compra_recepcion WHERE id_recepcion=$1 FOR UPDATE`,[id]);
    const r=rec.rows[0];
    if(usuario.tipo_usuario==='BODEGUERO'&&r.id_bodega!==usuario.id_bodega)throw new CompraError("No autorizado.",403);
    if(r.estado!=='RECONTAR')return respuesta(r);
    const conteo=await normalizarConteo(client,body.productos);
    if(conteo.length!==r.esperado.length||conteo.some(l=>!r.esperado.some(e=>e.id_producto===l.id_producto)))
      throw new CompraError("Recuenta los mismos productos de esta entrada. Registra otros productos en una entrada nueva.");
    const comparacion=evaluar(r.esperado,conteo,Number(compra.rows[0].tolerancia_porcentaje),r.parcial);
    const constancia=texto(body.constancia,"Constancia",4000,!comparacion.aceptable);
    const estado=comparacion.aceptable?'APLICADA':'PENDIENTE_DUENO';
    await client.query(`UPDATE compra_recepcion SET conteo=$2,intentos=2,constancia=$3,estado=$4 WHERE id_recepcion=$1`,[id,JSON.stringify(conteo),constancia,estado]);
    if(comparacion.aceptable)await aplicarStock(client,{...r,conteo},Number(compra.rows[0].tolerancia_porcentaje));
    else await actualizarEstado(client,r.id_compra);
    await client.query(`INSERT INTO compra_aviso (id_compra,mensaje) VALUES ($1,$2)`,[r.id_compra,comparacion.aceptable
      ?'Segundo conteo aceptado: cantidad real ingresada.' :'Diferencia confirmada: revisa la constancia y verifica esta entrada con el proveedor.']);
    return respuesta({id_recepcion:id,estado});
  });
}

export async function resolverCompra(id:number,body:Datos,idDueno:number) {
  return transaccion(async client=>{
    const c=await client.query(`SELECT * FROM compra WHERE id_compra=$1 FOR UPDATE`,[id]);
    if(!c.rowCount)throw new CompraError("Compra no disponible.",404);
    // Una factura puede tener más de una constancia: resuelve la seleccionada.
    const idRecepcion=body.id_recepcion==null?null:identificador(body.id_recepcion);
    const rec=await client.query<Recepcion>(`SELECT * FROM compra_recepcion WHERE id_compra=$1 AND estado='PENDIENTE_DUENO'
      AND ($2::int IS NULL OR id_recepcion=$2) ORDER BY id_recepcion FOR UPDATE`,[id,idRecepcion]);
    if(rec.rowCount!==1)throw new CompraError(rec.rowCount?'Selecciona la recepción que deseas resolver.':'Esta recepción ya fue resuelta o no requiere autorización.',409);
    if(body.accion!=='aprobar'&&body.accion!=='rechazar')throw new CompraError("Acción inválida.");
    const resolucion=texto(body.resolucion,"Verificación con el proveedor",4000,true);
    const r=rec.rows[0];
    await client.query(`UPDATE compra_recepcion SET resolucion=$2,id_dueno=$3 WHERE id_recepcion=$1`,[r.id_recepcion,resolucion,idDueno]);
    if(body.accion==='aprobar')await aplicarStock(client,r,Number(c.rows[0].tolerancia_porcentaje),idDueno);
    else {
      await client.query(`UPDATE compra_recepcion SET estado='RECHAZADA' WHERE id_recepcion=$1`,[r.id_recepcion]);
      await actualizarEstado(client,id);
    }
    return {mensaje:body.accion==='aprobar'?'Cantidad real de esta entrada ingresada al stock.':'Entrada rechazada. Sus productos quedan disponibles para una nueva recepción.'};
  });
}
