"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { calcularImpuestos, costoUnitarioCompra, compararRecepcion, margen, redondear, type Conteo, type Esperado, type ImpuestoCompra } from "@/lib/compras";
import { ProductoAutocompletar } from "@/components/ProductoAutocompletar";
import { CatalogoAutocompletar } from "@/components/inventario-catalogo/CatalogoAutocompletar";
import s from "./compras.module.css";

type Presentacion = { id_presentacion:number; nombre_presentacion:string; factor_conversion:string };
type Producto = { id_producto:number; nombre_producto:string; codigo_producto:string; unidad_medida:string;
  precio_unitario:string|null; precio_mayoreo:string|null; costo_anterior:string|null; presentaciones:Presentacion[] };
type Proveedor = { id_proveedor:number; nombre_proveedor:string; nit_proveedor:string; telefono:string|null; correo_contacto:string|null };
type Linea = { id_producto:string; id_presentacion:string; cantidad:string; costo:string; actualizar_precio:boolean;
  venta_nueva:string; mayoreo_nuevo:string; lote:string; fecha_caducidad:string };
type Detalle = { id_producto:number; nombre_producto:string; cantidad:string; cantidad_base:string; unidad_base:string;
  nombre_presentacion:string|null; costo:string; costo_base:string; costo_anterior:string|null; venta_anterior:string|null;
  mayoreo_anterior:string|null; venta_nueva:string|null; mayoreo_nuevo:string|null; actualizar_precio:boolean; lote:string; fecha_caducidad:string|null };
type Recepcion = { id_recepcion:number; estado:string; conteo:Conteo[]; primer_conteo:Conteo[]; esperado:Esperado[]; parcial:boolean; constancia:string|null; resolucion:string|null; id_bodega:number; creada_en:string };
type Compra = { id_compra:number; ticket:string; numero_factura:string; proveedor_datos:Proveedor; fecha_compra:string;
  condicion_pago:string; fecha_vencimiento:string|null; estado:string; subtotal:string; descuento:string; impuestos:string; transporte:string;
  total:string; pagado:string; tolerancia_porcentaje:string; productos:Detalle[]; recepciones:Recepcion[]; notas:string; impuestos_detalle:ImpuestoCompra[];
  pagos:{id_pago:number;fecha:string;monto:string;forma_pago:string;referencia:string}[] };
type Aviso = {id_aviso:number; id_compra:number;ticket:string;mensaje:string};
const hoy = () => new Date().toLocaleDateString("en-CA",{timeZone:"America/Guatemala"});
const dinero = (n:unknown) => n == null ? "Sin registro" : `Q ${Number(n).toFixed(2)}`;
const porcentaje = (n:number|null) => n == null ? "Sin registro" : `${n.toFixed(2)} %`;
const nuevaLinea = ():Linea => ({id_producto:"",id_presentacion:"",cantidad:"",costo:"",actualizar_precio:false,venta_nueva:"",mayoreo_nuevo:"",lote:"",fecha_caducidad:""});
const nuevaCabecera = () => ({id_proveedor:"",numero_factura:"",fecha_compra:hoy(),condicion_pago:"CONTADO",fecha_vencimiento:"",
  forma_pago:"Efectivo",referencia_pago:"",notas:"",direccion_entrega:"",tolerancia_porcentaje:"0",descuento:"0",transporte:"0",anticipo:"0"});

async function enviar(url:string, method:string, body:unknown) {
  const r = await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
  return d;
}

export function ComprasStock({onStockChange}:{onStockChange:()=>void}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [productos,setProductos] = useState<Producto[]>([]);
  const [proveedores,setProveedores] = useState<Proveedor[]>([]);
  const [compras,setCompras] = useState<Compra[]>([]);
  const [avisos,setAvisos] = useState<Aviso[]>([]);
  const [error,setError] = useState(""); const [mensaje,setMensaje] = useState("");
  const [cargando,setCargando] = useState(true); const [ocupado,setOcupado] = useState(false);
  const [abierto,setAbierto] = useState(false); const [revisar,setRevisar] = useState(false);
  const [cab,setCab] = useState(nuevaCabecera); const [lineas,setLineas] = useState<Linea[]>([nuevaLinea()]);
  const [clave,setClave] = useState("");
  const [tasas,setTasas] = useState<{nombre:string;porcentaje:string}[]>([]);
  const detalleSeleccionado = useRef<HTMLDivElement>(null);
  const [nuevoProveedor,setNuevoProveedor] = useState(false);
  const [prov,setProv] = useState({nombre_proveedor:"",nit_proveedor:"",telefono:"",correo_contacto:""});
  const [seleccion,setSeleccion] = useState<number|null>(null);
  const [resolucion,setResolucion] = useState("");
  const [pago,setPago] = useState({monto:"",fecha:hoy(),forma_pago:"Efectivo",referencia:""});
  const [clavePago,setClavePago] = useState("");
  useEffect(() => { setClavePago(crypto.randomUUID()); }, [seleccion]);
  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/compras",{cache:"no-store"}); const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudieron cargar las compras.");
      setProductos(d.productos); setProveedores(d.proveedores); setCompras(d.compras); setAvisos(d.avisos);
    } catch(e) { setError((e as Error).message); }
    finally { setCargando(false); }
  },[]);
  useEffect(() => {
    void cargar();
    const timer = setInterval(() => { void cargar();onStockChange(); },15000);
    return () => clearInterval(timer);
  },[cargar,onStockChange]);
  const cambiar = (i:number, datos:Partial<Linea>) => {setLineas(ls=>ls.map((l,j)=>i===j?{...l,...datos}:l));setRevisar(false);};
  const subtotal = redondear(lineas.reduce((n,l)=>n+redondear(Number(l.cantidad)*Number(l.costo)),0));
  const impuestosDetalle = calcularImpuestos(subtotal,Number(cab.descuento),tasas.map(t=>({...t,porcentaje:Number(t.porcentaje)})));
  const impuestos = redondear(impuestosDetalle.reduce((n,t)=>n+t.monto,0));
  const total = redondear(subtotal-Number(cab.descuento)+impuestos+Number(cab.transporte));
  const proveedor = proveedores.find(p=>p.id_proveedor===Number(cab.id_proveedor));
  const compra = compras.find(c=>c.id_compra===seleccion);
  const revision = compra?.recepciones.find(r=>r.estado==="PENDIENTE_DUENO");
  const elegirCompra = (id:number) => {
    setSeleccion(id);setResolucion("");
    setTimeout(()=>detalleSeleccionado.current?.scrollIntoView?.({behavior:"smooth",block:"start"}),0);
  };
  const validarSeleccion = () => {
    if(!cab.id_proveedor||lineas.some(l=>!l.id_producto)) {setError("Selecciona el proveedor y un producto válido en cada línea.");return false;}
    return true;
  };
  const ejecutar = async (fn:()=>Promise<void>) => {
    if (ocupado) return;
    setOcupado(true);setError("");setMensaje("");
    try {await fn();} catch(e) {setError((e as Error).message);} finally {setOcupado(false);}
  };
  const guardar = () => {
    if (!formulario.current?.reportValidity()||!validarSeleccion()) return;
    return ejecutar(async()=> {
    const result = await enviar("/api/compras","POST",{...cab,clave,impuestos_detalle:tasas,productos:lineas.map(l=>{
      const p = productos.find(p=>p.id_producto===Number(l.id_producto));
      return {...l,id_presentacion:l.id_presentacion?Number(l.id_presentacion):null,venta_anterior:p?.precio_unitario,mayoreo_anterior:p?.precio_mayoreo};
    })});
    setMensaje(`Compra registrada. Entrega el ticket ${result.ticket} a quien reciba los productos. El stock queda pendiente.`);
    window.dispatchEvent(new Event("inventario:compra-registrada"));
    setAbierto(false);setRevisar(false);setCab(nuevaCabecera());setLineas([nuevaLinea()]);setTasas([]);setClave("");await cargar();elegirCompra(result.id_compra);
    });
  };
  return <section aria-label="Compras y recepciones">
    <div className={s.panel}>
      <div className={s.row}><h2>Compra de inventario</h2><button className={`${s.button} ${abierto?s.danger:s.primary}`} disabled={cargando||ocupado} onClick={()=>{
        setAbierto(!abierto);if(!clave)setClave(crypto.randomUUID());setError("");
      }}>{abierto?"Cerrar formulario":"Registrar compra"}</button><button className={s.button} disabled={ocupado} onClick={()=>void cargar()}>Actualizar</button></div>
      <p className={s.help}>Registra la factura del proveedor al contado o a crédito. La recepción física se captura en Entrada y suma existencias cuando queda aceptada.</p>
      {cargando&&<p role="status">Cargando compras…</p>}
      {error&&<div role="alert" className={`${s.alert} ${s.error}`}>{error}</div>}
      {mensaje&&<div role="status" className={s.alert}>{mensaje}</div>}
      {avisos.map(a=><div key={a.id_aviso} className={s.alert} role="status"><strong>{a.ticket}</strong> · {a.mensaje}
        <div className={s.row}><button className={`${s.button} ${seleccion===a.id_compra?s.selected:""}`} onClick={()=>elegirCompra(a.id_compra)}>Ver compra</button>
        <button className={s.button} disabled={ocupado} onClick={()=>void ejecutar(async()=>{await enviar("/api/compras/avisos","PATCH",{id_aviso:a.id_aviso});await cargar();})}>Marcar leído</button></div>
      </div>)}
    </div>
    {abierto&&<form ref={formulario} className={s.panel} onSubmit={e=>{e.preventDefault();if(validarSeleccion()){setError("");setRevisar(true);}}}>
      <h3>Factura de compra</h3>
      <div className={s.grid}>
        <div className={s.field}><span>Proveedor *</span><CatalogoAutocompletar ariaLabel="Proveedor" opciones={proveedores.map(p=>({id:p.id_proveedor,nombre:`${p.nombre_proveedor} · ${p.nit_proveedor}`}))} value={cab.id_proveedor} onChange={id=>{setCab({...cab,id_proveedor:id});setRevisar(false);}} placeholder="Busca por nombre o NIT…"/></div>
        <label className={s.field}>Número de factura *<input required maxLength={80} value={cab.numero_factura} onChange={e=>{setCab({...cab,numero_factura:e.target.value});setRevisar(false);}}/></label>
        <label className={s.field}>Fecha de compra *<input type="date" required value={cab.fecha_compra} onChange={e=>{setCab({...cab,fecha_compra:e.target.value});setRevisar(false);}}/></label>
        <label className={s.field}>Condición de pago<select value={cab.condicion_pago} onChange={e=>{setCab({...cab,condicion_pago:e.target.value});setRevisar(false);}}><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option></select></label>
        {cab.condicion_pago==="CREDITO"&&<><label className={s.field}>Vencimiento *<input type="date" min={cab.fecha_compra} required value={cab.fecha_vencimiento} onChange={e=>{setCab({...cab,fecha_vencimiento:e.target.value});setRevisar(false);}}/></label>
        <label className={s.field}>Anticipo (Q)<input type="number" required min="0" max={total} step=".01" value={cab.anticipo} onChange={e=>{setCab({...cab,anticipo:e.target.value});setRevisar(false);}}/></label></>}
        <label className={s.field}>Forma de pago *<select value={cab.forma_pago} onChange={e=>{setCab({...cab,forma_pago:e.target.value});setRevisar(false);}}>{["Efectivo","Transferencia","Depósito","Cheque","Tarjeta"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className={s.field}>Referencia de pago<input maxLength={120} value={cab.referencia_pago} onChange={e=>{setCab({...cab,referencia_pago:e.target.value});setRevisar(false);}}/></label>
        <label className={s.field}>Dirección de entrega<input maxLength={255} value={cab.direccion_entrega} onChange={e=>{setCab({...cab,direccion_entrega:e.target.value});setRevisar(false);}}/></label>
        <label className={s.field}>Diferencia permitida al terminar de recibir (%)<input type="number" required min="0" max="100" step=".01" value={cab.tolerancia_porcentaje} onChange={e=>{setCab({...cab,tolerancia_porcentaje:e.target.value});setRevisar(false);}}/></label>
      </div>
      <p className={s.help}>Es el faltante o sobrante máximo que aceptarás sin autorizarlo manualmente, por producto. Por ejemplo: si compras 100 botellas y eliges 5 %, se acepta terminar con 95 a 105 botellas. Con 0 % debe coincidir exactamente. Las entregas parciales se acumulan; este límite se calcula sobre la cantidad comprada. Siempre se suma lo realmente recibido y se te avisa.</p>
      {proveedor&&<p className={s.help}>Contacto: {proveedor.telefono||"Sin teléfono"} · {proveedor.correo_contacto||"Sin correo"}. NIT: {proveedor.nit_proveedor}.</p>}
      <button type="button" className={`${s.button} ${nuevoProveedor?s.danger:s.primary}`} onClick={()=>setNuevoProveedor(!nuevoProveedor)}>{nuevoProveedor?"Cancelar proveedor":"Crear proveedor"}</button>
      {nuevoProveedor&&<div className={s.panel}><div className={s.grid}>{([['nombre_proveedor','Nombre'],['nit_proveedor','NIT'],['telefono','Teléfono'],['correo_contacto','Correo']] as const).map(([k,label])=><label key={k} className={s.field}>{label}<input value={prov[k]} type={k==='correo_contacto'?'email':'text'} maxLength={k==='nombre_proveedor'?150:k==='correo_contacto'?200:20} onChange={e=>setProv({...prov,[k]:e.target.value})}/></label>)}</div>
        <button type="button" className={`${s.button} ${s.primary}`} disabled={ocupado||!prov.nombre_proveedor.trim()||!prov.nit_proveedor.trim()} onClick={()=>void ejecutar(async()=>{
          const d=await enviar("/api/proveedores","POST",prov);await cargar();setCab(c=>({...c,id_proveedor:String(d.proveedor.id_proveedor)}));setNuevoProveedor(false);window.dispatchEvent(new Event("inventario:compra-registrada"));
        })}>Guardar proveedor</button></div>}
      <h3 style={{marginTop:"1rem"}}>Productos comprados</h3>
      {lineas.map((l,i)=>{
        const p=productos.find(p=>p.id_producto===Number(l.id_producto));
        return <fieldset key={i} className={s.panel}><legend>Producto {i+1}</legend><div className={s.grid}>
          <div className={s.field}><span>Producto *</span><ProductoAutocompletar ariaLabel={`Producto ${i+1}`} className={s.input} productos={productos.filter(p=>String(p.id_producto)===l.id_producto||!lineas.some(x=>Number(x.id_producto)===p.id_producto))} value={l.id_producto} onChange={id=>cambiar(i,{...nuevaLinea(),id_producto:id})}/></div>
          <div className={s.field}><span>Presentación</span><CatalogoAutocompletar ariaLabel={`Presentación ${i+1}`} opciones={[{id:0,nombre:p?.unidad_medida||"Unidad base"},...(p?.presentaciones||[]).map(pr=>({id:pr.id_presentacion,nombre:pr.nombre_presentacion}))]} value={l.id_presentacion||"0"} onChange={id=>cambiar(i,{id_presentacion:id==="0"?"":id})}/></div>
          <label className={s.field}>Cantidad comprada *<input required type="number" min=".001" step=".001" value={l.cantidad} onChange={e=>cambiar(i,{cantidad:e.target.value})}/></label>
          <label className={s.field}>Precio de compra por {p?.presentaciones.find(pr=>String(pr.id_presentacion)===l.id_presentacion)?.nombre_presentacion||p?.unidad_medida||"unidad"} (Q) *<input required type="number" min=".01" step=".01" value={l.costo} onChange={e=>cambiar(i,{costo:e.target.value})}/></label>
          <label className={s.field}>Lote<input maxLength={100} value={l.lote} onChange={e=>cambiar(i,{lote:e.target.value})}/></label>
          <label className={s.field}>Fecha de caducidad<input type="date" value={l.fecha_caducidad} onChange={e=>cambiar(i,{fecha_caducidad:e.target.value})}/></label>
        </div><span>Importe: {dinero(redondear(Number(l.cantidad)*Number(l.costo)))}</span>{lineas.length>1&&<button type="button" className={`${s.button} ${s.danger}`} onClick={()=>{setLineas(ls=>ls.filter((_,j)=>j!==i));setRevisar(false);}}>Quitar producto {i+1}</button>}</fieldset>;
      })}
      <button type="button" className={`${s.button} ${s.primary}`} onClick={()=>{setLineas([...lineas,nuevaLinea()]);setRevisar(false);}}>Agregar producto</button>
      <div className={s.grid} style={{marginTop:"1rem"}}>{([['descuento','Descuento global (Q)'],['transporte','Transporte (Q)']] as const).map(([k,label])=><label key={k} className={s.field}>{label}<input required type="number" min="0" step=".01" value={cab[k]} onChange={e=>{setCab({...cab,[k]:e.target.value});setRevisar(false);}}/></label>)}</div>
      <h3>Impuestos porcentuales</h3>
      {tasas.map((t,i)=><div className={s.row} key={i}><label className={s.field}>Nombre del impuesto {i+1}<input required maxLength={80} value={t.nombre} onChange={e=>{setTasas(ts=>ts.map((x,j)=>i===j?{...x,nombre:e.target.value}:x));setRevisar(false);}}/></label><label className={s.field}>Porcentaje del impuesto {i+1}<input required type="number" min="0" max="100" step=".01" value={t.porcentaje} onChange={e=>{setTasas(ts=>ts.map((x,j)=>i===j?{...x,porcentaje:e.target.value}:x));setRevisar(false);}}/></label><span>{dinero(impuestosDetalle[i].monto)}</span><button type="button" className={`${s.button} ${s.danger}`} onClick={()=>{setTasas(ts=>ts.filter((_,j)=>i!==j));setRevisar(false);}}>Quitar impuesto {i+1}</button></div>)}
      <button type="button" className={`${s.button} ${s.primary}`} onClick={()=>{setTasas([...tasas,{nombre:"",porcentaje:""}]);setRevisar(false);}}>Agregar impuesto</button>
      <p className={s.help}>Cada porcentaje se calcula sobre el subtotal después del descuento, sin incluir transporte ni otros impuestos. Introduce precios de compra sin los impuestos que agregues aquí.</p>
      <label className={s.field}>Observaciones<textarea maxLength={4000} value={cab.notas} onChange={e=>{setCab({...cab,notas:e.target.value});setRevisar(false);}}/></label>
      <p>Subtotal: {dinero(subtotal)} · Impuestos: {dinero(impuestos)} · <strong>Total: {dinero(total)}</strong></p>
      <button type="submit" className={s.button} disabled={ocupado||total<=0}>Comparar precios</button>
      {revisar&&<div className={s.alert}><h3>¿Cambiar los precios?</h3>
        <p className={s.help}>Comparamos todo por la unidad en que vendes, aunque compres por cajas o quintales. El margen indica qué porcentaje de la venta queda después del costo de compra.</p>
        {lineas.map((l,i)=>{
          const p=productos.find(p=>p.id_producto===Number(l.id_producto))!;
          const factor=Number(p.presentaciones.find(pr=>String(pr.id_presentacion)===l.id_presentacion)?.factor_conversion||1);
          const costo=costoUnitarioCompra(Number(l.cantidad),Number(l.costo),factor,total,subtotal);
          const anterior=p.costo_anterior==null?null:Number(p.costo_anterior);
          const venta=l.actualizar_precio?Number(l.venta_nueva):p.precio_unitario==null?null:Number(p.precio_unitario);
          const mayor=l.actualizar_precio?Number(l.mayoreo_nuevo):p.precio_mayoreo==null?null:Number(p.precio_mayoreo);
          return <fieldset className={s.comparacion} key={p.id_producto}><legend>{p.nombre_producto} · precios por {p.unidad_medida}</legend>
            <p><strong>Costo nuevo: {dinero(costo)} por {p.unidad_medida}</strong> <span className={s.help}>{anterior==null?'Primera compra registrada':`Anterior: ${dinero(anterior)}`}</span></p>
            <label className={s.field}>Decisión de precios de {p.nombre_producto}<select value={l.actualizar_precio?'cambiar':'conservar'} onChange={e=>setLineas(ls=>ls.map((x,j)=>j===i?{...x,actualizar_precio:e.target.value==='cambiar',venta_nueva:x.venta_nueva||p.precio_unitario||'',mayoreo_nuevo:x.mayoreo_nuevo||p.precio_mayoreo||''}:x))}><option value="conservar">Conservar precios actuales</option><option value="cambiar">Actualizar precios</option></select></label>
            <div className={s.grid} style={{marginTop:'.8rem'}}><div><span className={s.help}>Precio de venta actual por {p.unidad_medida}</span><p>{dinero(p.precio_unitario)}</p></div>
              {l.actualizar_precio&&<label className={s.field}>Venta nueva (Q por {p.unidad_medida})<input required type="number" min=".01" step=".01" value={l.venta_nueva} onChange={e=>setLineas(ls=>ls.map((x,j)=>j===i?{...x,venta_nueva:e.target.value}:x))}/></label>}
              <div><span className={s.help}>Con el costo nuevo, ganarías por {p.unidad_medida}</span><p><strong>{venta==null?'Sin precio':dinero(venta-costo)}</strong> · Margen: {porcentaje(margen(venta,costo))}</p></div></div>
            <details open={l.actualizar_precio}><summary>Precio al mayoreo</summary><div className={s.grid}><p>Actual: {dinero(p.precio_mayoreo)} por {p.unidad_medida}</p>
              {l.actualizar_precio&&<label className={s.field}>Mayoreo nuevo (Q por {p.unidad_medida})<input required type="number" min=".01" step=".01" value={l.mayoreo_nuevo} onChange={e=>setLineas(ls=>ls.map((x,j)=>j===i?{...x,mayoreo_nuevo:e.target.value}:x))}/></label>}
              <p>Ganancia: {mayor==null?'Sin precio':dinero(mayor-costo)} · Margen: {porcentaje(margen(mayor,costo))}</p></div></details>
          </fieldset>;
        })}
        <p className={s.help}>Al confirmar se registra la factura{cab.condicion_pago==="CREDITO"?" y su cuenta por pagar":" como pagada"}, se aplican los precios elegidos y se genera el ticket pendiente de recepción.</p>
        <button type="button" className={`${s.button} ${s.primary}`} disabled={ocupado} onClick={()=>void guardar()}>{ocupado?"Registrando…":"Confirmar compra y precios"}</button>
      </div>}
    </form>}
    <div className={s.panel}><h3>Tickets y cuentas por pagar</h3><p className={s.help}>Las compras pendientes y los saldos sin pagar aparecen primero. Se muestran hasta 200 compras.</p>
      {!cargando&&!compras.length&&<p>Aún no hay compras registradas.</p>}
      <div className={s.scroll}><table className={s.table}><thead><tr><th>Ticket / factura</th><th>Proveedor</th><th>Fecha</th><th>Recepción</th><th>Pago</th><th>Total / saldo</th><th>Detalle</th></tr></thead><tbody>{compras.map(c=><tr key={c.id_compra} className={seleccion===c.id_compra?s.selectedRow:undefined} aria-selected={seleccion===c.id_compra}>
        <td>{c.ticket}<br/>{c.numero_factura}{seleccion===c.id_compra&&<div className={s.selectionLabel}>Factura seleccionada</div>}</td><td>{c.proveedor_datos.nombre_proveedor}</td><td>{c.fecha_compra.slice(0,10)}</td><td>{c.estado==='PARCIAL'?'Recibida parcialmente':c.estado}</td><td>{c.condicion_pago}<br/>{Number(c.total)<=Number(c.pagado)?"Pagada":`Vence: ${c.fecha_vencimiento?.slice(0,10)}`}</td><td>{dinero(c.total)}<br/>Saldo: {dinero(redondear(Number(c.total)-Number(c.pagado)))}</td><td><button className={`${s.button} ${seleccion===c.id_compra?s.selected:""}`} aria-pressed={seleccion===c.id_compra} onClick={()=>{elegirCompra(c.id_compra);setPago({monto:"",fecha:hoy(),forma_pago:"Efectivo",referencia:""});setClavePago(crypto.randomUUID());}}>{seleccion===c.id_compra?"Viendo factura":"Ver"}</button></td>
      </tr>)}</tbody></table></div>
    </div>
    {compra&&<div ref={detalleSeleccionado} className={`${s.panel} ${s.selectedDetail}`}><p className={s.selectionLabel}>Estás viendo la factura seleccionada</p><div className={s.row}><h3>Factura {compra.numero_factura} · {compra.ticket}</h3><button className={`${s.button} ${s.danger}`} onClick={()=>setSeleccion(null)}>Cerrar factura</button></div>
      <p>{compra.proveedor_datos.nombre_proveedor} · NIT {compra.proveedor_datos.nit_proveedor}<br/>Contacto: {compra.proveedor_datos.telefono||"Sin teléfono"} · {compra.proveedor_datos.correo_contacto||"Sin correo"}</p>
      <p className={s.help}>Fecha: {compra.fecha_compra.slice(0,10)} · Tolerancia: {compra.tolerancia_porcentaje} % · {compra.notas}</p>
      <div className={s.scroll}><table className={s.table}><thead><tr><th>Producto</th><th>Comprado</th><th>Costo</th><th>Costo final / unidad base</th><th>Venta anterior → nueva</th><th>Margen con costo nuevo</th></tr></thead><tbody>{compra.productos.map(d=><tr key={d.id_producto}>
        <td>{d.nombre_producto}{d.lote&&<><br/>Lote: {d.lote}</>}{d.fecha_caducidad&&<><br/>Caduca: {d.fecha_caducidad.slice(0,10)}</>}</td><td><strong>{Number(d.cantidad).toLocaleString("es-GT")} {d.nombre_presentacion||d.unidad_base}</strong></td><td>{dinero(d.costo)}</td><td>{dinero(d.costo_base)} / {d.unidad_base}</td><td>{dinero(d.venta_anterior)} → {dinero(d.venta_nueva)}<br/>Mayoreo: {dinero(d.mayoreo_anterior)} → {dinero(d.mayoreo_nuevo)}</td><td>{porcentaje(margen(d.venta_nueva==null?null:Number(d.venta_nueva),Number(d.costo_base)))}</td>
      </tr>)}</tbody></table></div><p>Subtotal {dinero(compra.subtotal)} − descuento {dinero(compra.descuento)} + impuestos {dinero(compra.impuestos)} + transporte {dinero(compra.transporte)} = <strong>{dinero(compra.total)}</strong></p>
      {!!compra.impuestos_detalle?.length&&<ul>{compra.impuestos_detalle.map((t,i)=><li key={i}>{t.nombre} ({t.porcentaje} %): {dinero(t.monto)}</li>)}</ul>}
      <details><summary>Avance de recepción por producto</summary>{compra.productos.map(d=>{
        const recibido=compra.recepciones.filter(r=>r.estado==='APLICADA').reduce((n,r)=>n+(r.conteo.find(l=>l.id_producto===d.id_producto)?.cantidad_base??0),0);
        const factor=Number(d.cantidad_base)/Number(d.cantidad);
        return <p key={d.id_producto}>{d.nombre_producto}: {redondear(recibido/factor,3)} de {Number(d.cantidad)} {d.nombre_presentacion||d.unidad_base} recibidos</p>;
      })}</details>
      {compra.recepciones.map(r=>{
        const dif=compararRecepcion(r.esperado||[],r.conteo,Number(compra.tolerancia_porcentaje));
        return <div key={r.id_recepcion} className={s.alert}><h3>Recepción #{r.id_recepcion} · {r.estado}</h3><p>Bodega #{r.id_bodega} · {new Date(r.creada_en).toLocaleString("es-GT")}</p>
          <div className={s.scroll}><table className={s.table}><thead><tr><th>Producto</th><th>Comprado</th><th>Primer conteo</th><th>Último conteo</th><th>Diferencia</th></tr></thead><tbody>{dif.diferencias.map(d=>{
            const p=compra.productos.find(p=>p.id_producto===d.id_producto)!;
            const factor=Number(p.cantidad_base)/Number(p.cantidad);
            return <tr key={d.id_producto}><td>{p.nombre_producto} ({p.nombre_presentacion||p.unidad_base})</td><td>{redondear(d.esperado/factor,3)}</td><td>{redondear((r.primer_conteo.find(l=>l.id_producto===d.id_producto)?.cantidad_base??0)/factor,3)}</td><td>{redondear(d.recibido/factor,3)}</td><td>{redondear(d.diferencia/factor,3)}</td></tr>;
          })}</tbody></table></div>{r.constancia&&<p>Constancia: {r.constancia}</p>}{r.resolucion&&<p>Verificación: {r.resolucion}</p>}</div>;
      })}
      {revision&&<div className={s.alert}><h3>Autorizar recepción #{revision.id_recepcion} con diferencia</h3><p>Verifica la diferencia con el proveedor. Al aprobar se suma exclusivamente la cantidad real de esta entrada. Los demás productos conservan su propio avance.</p>
        <label className={s.field}>Constancia de verificación con el proveedor *<textarea maxLength={4000} value={resolucion} onChange={e=>setResolucion(e.target.value)}/></label><div className={s.row}>{([['aprobar','Autorizar stock real'],['rechazar','Rechazar recepción']] as const).map(([accion,label])=><button key={accion} className={`${s.button} ${accion==='aprobar'?s.primary:s.danger}`} disabled={ocupado||!resolucion.trim()} onClick={()=>void ejecutar(async()=>{
          const d=await enviar(`/api/compras/${compra.id_compra}`,"PATCH",{accion,resolucion,id_recepcion:revision.id_recepcion});setMensaje(d.mensaje);setResolucion("");await cargar();onStockChange();
        })}>{label}</button>)}</div></div>}
      {Number(compra.total)>Number(compra.pagado)&&<form onSubmit={e=>{e.preventDefault();void ejecutar(async()=>{
        const d=await enviar(`/api/compras/${compra.id_compra}/pagos`,"POST",{...pago,clave:clavePago||crypto.randomUUID()});setMensaje(d.mensaje);setPago({...pago,monto:""});setClavePago(crypto.randomUUID());await cargar();
      });}}><h3>Registrar pago a proveedor</h3><div className={s.grid}><label className={s.field}>Monto (Q)<input required type="number" min=".01" step=".01" max={redondear(Number(compra.total)-Number(compra.pagado))} value={pago.monto} onChange={e=>setPago({...pago,monto:e.target.value})}/></label>
        <label className={s.field}>Fecha<input type="date" required value={pago.fecha} onChange={e=>setPago({...pago,fecha:e.target.value})}/></label><label className={s.field}>Forma de pago<input required maxLength={50} value={pago.forma_pago} onChange={e=>setPago({...pago,forma_pago:e.target.value})}/></label><label className={s.field}>Referencia<input maxLength={120} value={pago.referencia} onChange={e=>setPago({...pago,referencia:e.target.value})}/></label></div><button className={`${s.button} ${s.primary}`} disabled={ocupado}>Guardar pago</button></form>}
      {!!compra.pagos.length&&<details><summary>Historial de pagos</summary>{compra.pagos.map(p=><p key={p.id_pago}>{p.fecha.slice(0,10)} · {dinero(p.monto)} · {p.forma_pago} · {p.referencia}</p>)}</details>}
    </div>}
  </section>;
}
