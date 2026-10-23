"use client";
import { useCallback, useEffect, useState } from "react";
import type { Conteo } from "@/lib/compras";
import { ProductoAutocompletar } from "@/components/ProductoAutocompletar";
import { CatalogoAutocompletar } from "@/components/inventario-catalogo/CatalogoAutocompletar";
import s from "./compras.module.css";

type Producto = {id_producto:number;nombre_producto:string;codigo_producto:string;unidad_medida:string};
type Presentacion = {id_presentacion:number;nombre_presentacion:string;factor_conversion:string};
type Linea = {id_producto:string;id_presentacion:string;cantidad:string};
type Recepcion = {id_recepcion:number;id_bodega:number;estado:string;conteo:Conteo[];nombre_bodega:string;creada_en:string;parcial:boolean};
const vacia = ():Linea => ({id_producto:"",id_presentacion:"",cantidad:""});
const ESTADOS:Record<string,string> = {RECONTAR:"Requiere segundo conteo",PENDIENTE_DUENO:"Constancia en revisión",APLICADA:"Stock actualizado",RECHAZADA:"Recepción rechazada"};

function LineaRecibida({value,productos,onChange,onRemove,disabled,recuento,indice}:{value:Linea;productos:Producto[];onChange:(v:Linea)=>void;onRemove:()=>void;disabled:boolean;recuento:boolean;indice:number}) {
  const [presentaciones,setPresentaciones] = useState<Presentacion[]>([]);
  const [error,setError] = useState("");
  useEffect(()=>{
    const controller=new AbortController();setPresentaciones([]);setError("");
    if(value.id_producto) fetch(`/api/presentaciones?id_producto=${value.id_producto}`,{signal:controller.signal}).then(async r=>{
      if(!r.ok) throw new Error("No se pudieron cargar las presentaciones.");
      const d=await r.json();setPresentaciones(d.presentaciones||[]);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[value.id_producto]);
  const producto=productos.find(p=>p.id_producto===Number(value.id_producto));
  return <fieldset className={s.panel} disabled={disabled}><legend>Producto recibido</legend><div className={s.grid}>
    <div className={s.field}><span>Producto *</span><ProductoAutocompletar ariaLabel={`Producto recibido ${indice+1}`} className={s.input} productos={productos} value={value.id_producto} disabled={disabled||recuento} onChange={id=>onChange({id_producto:id,id_presentacion:"",cantidad:""})}/></div>
    <div className={s.field}><span>Presentación</span><CatalogoAutocompletar ariaLabel={`Presentación recibida ${indice+1}`} opciones={[{id:0,nombre:producto?.unidad_medida||"Unidad base"},...presentaciones.map(p=>({id:p.id_presentacion,nombre:p.nombre_presentacion}))]} value={value.id_presentacion||"0"} disabled={disabled} onChange={id=>onChange({...value,id_presentacion:id==="0"?"":id})}/></div>
    <label className={s.field}>Cantidad contada *<input required type="number" min="0" max="999999999" step=".001" value={value.cantidad} onChange={e=>onChange({...value,cantidad:e.target.value})}/></label>
  </div>{error&&<p role="alert">{error}</p>}{!recuento&&<button type="button" className={`${s.button} ${s.danger}`} onClick={onRemove}>Quitar producto</button>}</fieldset>;
}

export function RecepcionEntrada({idBodega,onRecibido}:{idBodega?:number;onRecibido?:()=>void}) {
  const [productos,setProductos] = useState<Producto[]>([]);
  const [bodegas,setBodegas] = useState<{id_bodega:number;nombre_bodega:string}[]>([]);
  const [bodega,setBodega] = useState(idBodega?String(idBodega):"");
  const [lineas,setLineas] = useState<Linea[]>([vacia()]);
  const [ticket,setTicket] = useState("");
  const [constancia,setConstancia] = useState("");
  const [recepciones,setRecepciones] = useState<Recepcion[]>([]);
  const [pendientes,setPendientes] = useState<Recepcion[]>([]);
  const [parcial,setParcial] = useState(false);
  const [idRecuento,setIdRecuento] = useState<number|null>(null);
  const [clave,setClave] = useState("");
  const [error,setError] = useState("");const [mensaje,setMensaje] = useState("");const [ocupado,setOcupado] = useState(false);
  const [cargando,setCargando] = useState(true);
  const cargar = useCallback(async()=>{
    const r=await fetch("/api/recepciones",{cache:"no-store"});const d=await r.json();
    if(!r.ok)throw new Error(d.error||"No se pudieron cargar las recepciones.");
    setRecepciones(d.recepciones||[]);
    setPendientes(d.pendientes||[]);
  },[]);
  useEffect(()=>{
    let activo=true;
    Promise.all([cargar(),fetch("/api/productos").then(async r=>{if(!r.ok)throw new Error("No se pudieron cargar los productos.");setProductos((await r.json()).productos||[]);}),
      fetch("/api/bodegas/simple").then(async r=>{if(!r.ok)throw new Error("No se pudieron cargar las bodegas.");setBodegas((await r.json()).bodegas||[]);})])
      .catch(e=>{if(activo)setError(e.message);}).finally(()=>{if(activo)setCargando(false);});
    setClave(crypto.randomUUID());
    const timer=setInterval(()=>void cargar().catch(()=>{}),15000);
    return ()=>{activo=false;clearInterval(timer);};
  },[cargar]);
  const limpiar=()=>{setIdRecuento(null);setLineas([vacia()]);setConstancia("");setTicket("");setParcial(false);setClave(crypto.randomUUID());};
  const reanudar=(r:Recepcion)=>{
    setIdRecuento(r.id_recepcion);setBodega(String(r.id_bodega));setMensaje("La cantidad no coincide. Cuenta nuevamente todos los productos.");setError("");
    setParcial(r.parcial);
    setLineas(r.conteo.map(l=>({id_producto:String(l.id_producto),id_presentacion:l.id_presentacion?String(l.id_presentacion):"",cantidad:""})));setConstancia("");
  };
  const enviar=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(ocupado)return;setError("");setMensaje("");setOcupado(true);
    try {
      if(!bodega||lineas.some(l=>!l.id_producto))throw new Error("Selecciona una bodega y los productos recibidos.");
      const r=await fetch(idRecuento?`/api/recepciones/${idRecuento}`:"/api/recepciones",{
        method:idRecuento?"PATCH":"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({clave,ticket:ticket.trim().toUpperCase(),id_bodega:Number(bodega),constancia,parcial,
          productos:lineas.map(l=>({...l,id_producto:Number(l.id_producto),id_presentacion:l.id_presentacion?Number(l.id_presentacion):null}))}),
      });
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo registrar la recepción.");
      setMensaje(d.mensaje);
      if(d.estado==="RECONTAR") {setIdRecuento(d.id_recepcion);setLineas(ls=>ls.map(l=>({...l,cantidad:""})));}
      else {limpiar();if(d.estado==="APLICADA")onRecibido?.();}
      await cargar();
    }catch(e){setError((e as Error).message);}finally{setOcupado(false);}
  };
  return <section aria-label="Entrada de productos">
    <form className={s.panel} onSubmit={e=>void enviar(e)}><h2>Entrada de productos</h2>
      <p className={s.help}>Registra solo los productos que llegaron en esta entrada. Los demás pueden recibirse después, incluso en otra bodega. Si un mismo producto llegará en varias partes, marca «Entrega parcial».</p>
      {error&&<div role="alert" className={`${s.alert} ${s.error}`}>{error}</div>}{mensaje&&<div role="status" className={s.alert}>{mensaje}</div>}
      <fieldset disabled={ocupado||cargando} style={{border:0,padding:0}}>
        <div className={s.grid}><div className={s.field}><span>Bodega *</span><CatalogoAutocompletar ariaLabel="Bodega" opciones={bodegas.filter(b=>!idBodega||b.id_bodega===idBodega).map(b=>({id:b.id_bodega,nombre:b.nombre_bodega}))} value={bodega} disabled={!!idBodega||!!idRecuento} onChange={setBodega}/></div>
        {!idRecuento&&<label className={s.field}>Código de ticket (opcional)<input maxLength={50} value={ticket} placeholder="REC-…" onChange={e=>setTicket(e.target.value)}/></label>}</div>
        {lineas.map((l,i)=><LineaRecibida key={i} value={l} productos={productos.filter(p=>String(p.id_producto)===l.id_producto||!lineas.some(x=>Number(x.id_producto)===p.id_producto))} disabled={ocupado} recuento={!!idRecuento} indice={i}
          onChange={v=>setLineas(ls=>ls.map((x,j)=>i===j?v:x))} onRemove={()=>setLineas(ls=>ls.length===1?[vacia()]:ls.filter((_,j)=>i!==j))}/>)}
        {!idRecuento&&<><button type="button" className={`${s.button} ${s.primary}`} onClick={()=>setLineas([...lineas,vacia()])}>Agregar producto recibido</button>
          <label className={s.row}><input type="checkbox" checked={parcial} onChange={e=>setParcial(e.target.checked)}/>Entrega parcial: todavía llegará más cantidad de estos productos</label></>}
        {idRecuento&&<div className={s.alert}><h3>Segundo conteo · recepción #{idRecuento}</h3><p>Vuelve a contar físicamente. Si la diferencia persiste, describe lo ocurrido para dejar constancia y solicitar revisión.</p><label className={s.field}>Constancia de recepción<textarea maxLength={4000} rows={4} value={constancia} onChange={e=>setConstancia(e.target.value)} placeholder="Faltantes, daños, observaciones de la entrega y quién realizó el segundo conteo…"/></label></div>}
        <div className={s.row}><button type="submit" className={`${s.button} ${s.primary}`}>{ocupado?"Verificando…":idRecuento?"Confirmar segundo conteo":"Verificar recepción"}</button>
          {idRecuento&&<button type="button" className={`${s.button} ${s.danger}`} onClick={limpiar}>Dejar pendiente y recibir otra entrega</button>}</div>
      </fieldset>
    </form>
    {!!pendientes.length&&<div aria-label="Recuentos pendientes">{pendientes.map(r=><div className={s.pending} key={r.id_recepcion}><strong>Recuento pendiente #{r.id_recepcion}</strong><p className={s.help}>{r.nombre_bodega}</p><button className={s.button} disabled={ocupado} onClick={()=>reanudar(r)}>Realizar segundo conteo</button></div>)}</div>}
    <div className={s.history}><h3 className={s.historyTitle}>Mis recepciones recientes</h3>{cargando&&<p>Cargando…</p>}{!cargando&&!recepciones.length&&<p className={s.help}>Sin recepciones recientes</p>}
      {recepciones.slice(0,5).map(r=><div className={s.historyRow} key={r.id_recepcion}><strong>Recepción #{r.id_recepcion}</strong> · {ESTADOS[r.estado]||r.estado}
        <div>{r.conteo.map((l,i)=><span key={l.id_producto}>{i>0?' · ':''}{l.cantidad} {l.nombre_presentacion||l.unidad_base} de {productos.find(p=>p.id_producto===l.id_producto)?.nombre_producto||'producto'}</span>)}</div>
        <div className={s.historyMeta}>{r.nombre_bodega} · {new Date(r.creada_en).toLocaleString("es-GT",{dateStyle:'short',timeStyle:'short'})}</div>
      </div>)}
    </div>
  </section>;
}
