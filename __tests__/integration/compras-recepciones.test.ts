/** @jest-environment node */
import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { GET as listarCompras, POST as comprar } from "@/app/api/compras/route";
import { PATCH as resolver } from "@/app/api/compras/[id]/route";
import { POST as pagar } from "@/app/api/compras/[id]/pagos/route";
import { GET as misRecepciones, POST as recibir } from "@/app/api/recepciones/route";
import { PATCH as recontar } from "@/app/api/recepciones/[id]/route";
import { POST as entradaDirecta } from "@/app/api/inventario/entrada/route";
import { createMockRequest } from "@/__tests__/utils/api-test-utils";
import type { UsuarioParaFirmar } from "@/lib/auth";

const suite = process.env.DATABASE_URL ? describe : describe.skip;
suite("Compras, recepción ciega y autorización (PostgreSQL)",()=>{
  const prefijo=`compra-test-${randomUUID().slice(0,8)}`;
  let categoria:number, marca:number, proveedor:number, bodega:number, otraBodega:number;
  let dueno:UsuarioParaFirmar, bodeguero:UsuarioParaFirmar, empleado:UsuarioParaFirmar;
  const productos:number[]=[]; const usuarios:number[]=[];
  const contexto=(id:number)=>({params:Promise.resolve({id:String(id)})});
  const request=(url:string,user:UsuarioParaFirmar,body?:unknown,method="POST")=>createMockRequest(url,{user,body,method});
  const stock=async(id:number,bod=bodega)=>Number((await pool.query(`SELECT cantidad_disponible FROM bodega_producto WHERE id_producto=$1 AND id_bodega=$2`,[id,bod])).rows[0]?.cantidad_disponible||0);
  async function nuevaCompra(overrides:Record<string,unknown>={}) {
    const id=(await pool.query(`INSERT INTO producto (codigo_producto,nombre_producto,unidad_medida,id_categoria,id_marca,precio_unitario,precio_mayoreo)
      VALUES ($1,$1,'unidad',$2,$3,5,4) RETURNING id_producto`,[`${prefijo}-${productos.length}`,categoria,marca])).rows[0].id_producto;
    productos.push(id);
    const pres=(await pool.query(`INSERT INTO presentacion_producto (id_producto,nombre_presentacion,factor_conversion,unidad_base)
      VALUES ($1,'Caja de 24',24,'unidad') RETURNING id_presentacion`,[id])).rows[0].id_presentacion;
    return {clave:randomUUID(),id_proveedor:proveedor,numero_factura:`F-${randomUUID()}`,fecha_compra:"2026-10-20",condicion_pago:"CONTADO",
      forma_pago:"Efectivo",tolerancia_porcentaje:0,descuento:0,impuestos_detalle:[],transporte:0,anticipo:0,
      productos:[{id_producto:id,id_presentacion:pres,cantidad:2,costo:48,actualizar_precio:false,venta_anterior:5,mayoreo_anterior:4}],...overrides};
  }
  async function registrar(body:Awaited<ReturnType<typeof nuevaCompra>>) {
    const res=await comprar(request("/api/compras",dueno,body));
    const data=await res.json();expect({status:res.status,data}).toMatchObject({status:201});return data as {id_compra:number;ticket:string};
  }
  const entrada=(ticket:string,id:number,cantidad:number,pres:number|null=null,extras:Record<string,unknown>={})=>({
    clave:randomUUID(),ticket,id_bodega:otraBodega,productos:[{id_producto:id,id_presentacion:pres,cantidad}],...extras,
  });
  beforeAll(async()=>{
    categoria=(await pool.query(`INSERT INTO categoria (nombre_categoria) VALUES ($1) RETURNING id_categoria`,[prefijo])).rows[0].id_categoria;
    marca=(await pool.query(`INSERT INTO marca (nombre_marca) VALUES ($1) RETURNING id_marca`,[prefijo])).rows[0].id_marca;
    proveedor=(await pool.query(`INSERT INTO proveedor (nombre_proveedor,nit_proveedor,telefono,correo_contacto) VALUES ($1,$2,'5555','proveedor@test.local') RETURNING id_proveedor`,[prefijo,prefijo])).rows[0].id_proveedor;
    bodega=(await pool.query(`INSERT INTO bodega (nombre_bodega) VALUES ($1) RETURNING id_bodega`,[prefijo])).rows[0].id_bodega;
    otraBodega=(await pool.query(`INSERT INTO bodega (nombre_bodega) VALUES ($1) RETURNING id_bodega`,[`${prefijo}-otra`])).rows[0].id_bodega;
    for(const tipo of ["DUENO","BODEGUERO","EMPLEADO"]) {
      const u=(await pool.query(`INSERT INTO usuario (nombre,correo,contrasena_hash,tipo_usuario,id_bodega) VALUES ($1,$2,'test',$3,$4)
        RETURNING id_usuario,nombre,correo,tipo_usuario,id_bodega,sesion_version`,[prefijo,`${prefijo}-${tipo}@test.local`,tipo,tipo==="BODEGUERO"?bodega:null])).rows[0] as UsuarioParaFirmar;
      usuarios.push(u.id_usuario);if(tipo==="DUENO")dueno=u;else if(tipo==="BODEGUERO")bodeguero=u;else empleado=u;
    }
  });
  afterAll(async()=>{
    // Solo elimina los registros de esta ejecución, incluidos sus movimientos.
    await pool.query(`DELETE FROM compra_aviso WHERE id_compra IN (SELECT id_compra FROM compra WHERE id_proveedor=$1)`,[proveedor]);
    await pool.query(`DELETE FROM compra_recepcion WHERE id_compra IN (SELECT id_compra FROM compra WHERE id_proveedor=$1)`,[proveedor]);
    await pool.query(`DELETE FROM compra_pago WHERE id_compra IN (SELECT id_compra FROM compra WHERE id_proveedor=$1)`,[proveedor]);
    await pool.query(`DELETE FROM compra_detalle WHERE id_compra IN (SELECT id_compra FROM compra WHERE id_proveedor=$1)`,[proveedor]);
    await pool.query(`DELETE FROM compra WHERE id_proveedor=$1`,[proveedor]);
    await pool.query(`DELETE FROM kardex WHERE id_producto=ANY($1::int[])`,[productos]);
    await pool.query(`DELETE FROM bodega_producto WHERE id_producto=ANY($1::int[])`,[productos]);
    await pool.query(`DELETE FROM producto_proveedor WHERE id_proveedor=$1`,[proveedor]);
    await pool.query(`DELETE FROM presentacion_producto WHERE id_producto=ANY($1::int[])`,[productos]);
    await pool.query(`DELETE FROM producto WHERE id_producto=ANY($1::int[])`,[productos]);
    await pool.query(`DELETE FROM usuario WHERE id_usuario=ANY($1::int[])`,[usuarios]);
    await pool.query(`DELETE FROM bodega WHERE id_bodega=ANY($1::int[])`,[[bodega,otraBodega]]);
    await pool.query(`DELETE FROM proveedor WHERE id_proveedor=$1`,[proveedor]);
    await pool.query(`DELETE FROM categoria WHERE id_categoria=$1`,[categoria]);
    await pool.query(`DELETE FROM marca WHERE id_marca=$1`,[marca]);
    await pool.end();
  });
  it("registra factura pagada sin stock, conserva precios y no duplica compras por reintentos",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const otra=await registrar(body);
    expect(otra.id_compra).toBe(c.id_compra);expect(await stock(body.productos[0].id_producto)).toBe(0);
    expect((await pool.query(`SELECT precio_unitario FROM producto WHERE id_producto=$1`,[body.productos[0].id_producto])).rows[0].precio_unitario).toBe("5.00");
    expect(Number((await pool.query(`SELECT SUM(monto) AS total FROM compra_pago WHERE id_compra=$1`,[c.id_compra])).rows[0].total)).toBe(96);
  });
  it("crea cuenta a crédito, actualiza precios elegidos y paga sin exceder saldo ni duplicar el pago",async()=>{
    const body=await nuevaCompra({condicion_pago:"CREDITO",fecha_vencimiento:"2026-11-20",anticipo:10});
    Object.assign(body.productos[0],{actualizar_precio:true,venta_nueva:6,mayoreo_nuevo:5});
    const c=await registrar(body);
    expect((await pool.query(`SELECT precio_unitario FROM producto WHERE id_producto=$1`,[body.productos[0].id_producto])).rows[0].precio_unitario).toBe("6.00");
    const pago={clave:randomUUID(),monto:20,fecha:"2026-10-21",forma_pago:"Transferencia"};
    for(let i=0;i<2;i++)expect((await pagar(request("/api/compras/pago",dueno,pago),contexto(c.id_compra))).status).toBe(200);
    expect(Number((await pool.query(`SELECT SUM(monto) AS total FROM compra_pago WHERE id_compra=$1`,[c.id_compra])).rows[0].total)).toBe(30);
    expect((await pagar(request("/api/compras/pago",dueno,{...pago,clave:randomUUID(),monto:100}),contexto(c.id_compra))).status).toBe(400);
  });
  it("convierte presentaciones, vincula automáticamente y suma stock una sola vez en la bodega asignada",async()=>{
    const body=await nuevaCompra();await registrar(body);const l=body.productos[0];
    const payload=entrada("",l.id_producto,2,l.id_presentacion);
    const responses=await Promise.all([recibir(request("/api/recepciones",bodeguero,payload)),recibir(request("/api/recepciones",bodeguero,payload))]);
    for(const r of responses){expect(r.status).toBe(200);expect(await r.json()).toMatchObject({estado:"APLICADA"});}
    expect(await stock(l.id_producto)).toBe(48);expect(await stock(l.id_producto,otraBodega)).toBe(0);
    const k=await pool.query(`SELECT cantidad,cantidad_presentacion FROM kardex WHERE id_producto=$1`,[l.id_producto]);
    expect(k.rows).toEqual([{cantidad:"48.000",cantidad_presentacion:"2.000"}]);
  });
  it("exige recuento, guarda constancia y espera autorización del dueño para ingresar lo real",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const l=body.productos[0];
    const first=await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,l.id_producto,40)));
    const r=await first.json();expect(r.estado).toBe("RECONTAR");expect(await stock(l.id_producto)).toBe(0);
    expect((await recontar(request("/api/recontar",bodeguero,{productos:[{id_producto:l.id_producto,cantidad:41}]}),contexto(r.id_recepcion))).status).toBe(400);
    const second=await recontar(request("/api/recontar",bodeguero,{productos:[{id_producto:l.id_producto,cantidad:41}],constancia:"Segundo conteo realizado: faltan productos."}),contexto(r.id_recepcion));
    expect((await second.json()).estado).toBe("PENDIENTE_DUENO");expect(await stock(l.id_producto)).toBe(0);
    const listado=await (await misRecepciones(request("/api/recepciones",bodeguero,undefined,"GET"))).json();
    const own=listado.recepciones.find((x:{id_recepcion:number})=>x.id_recepcion===r.id_recepcion);
    expect(Object.keys(own).sort()).toEqual(["id_recepcion","id_bodega","estado","conteo","constancia","creada_en","nombre_bodega","parcial"].sort());
    expect(JSON.stringify(own)).not.toMatch(/costo|factura|tolerancia|esperado|precio|proveedor/);
    const res=await resolver(request("/api/resolver",dueno,{accion:"aprobar",resolucion:"Proveedor contactado, acepta faltante."},"PATCH"),contexto(c.id_compra));
    expect(res.status).toBe(200);expect(await stock(l.id_producto)).toBe(41);
    expect((await resolver(request("/api/resolver",dueno,{accion:"aprobar",resolucion:"Reintento"},"PATCH"),contexto(c.id_compra))).status).toBe(409);
    expect(await stock(l.id_producto)).toBe(41);
  });
  it("acepta diferencias dentro de tolerancia y avisa siempre al dueño",async()=>{
    const body=await nuevaCompra({tolerancia_porcentaje:5});const c=await registrar(body);
    const res=await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,body.productos[0].id_producto,46)));
    expect((await res.json()).estado).toBe("APLICADA");expect(await stock(body.productos[0].id_producto)).toBe(46);
    expect((await pool.query(`SELECT mensaje FROM compra_aviso WHERE id_compra=$1`,[c.id_compra])).rows[0].mensaje).toMatch(/tolerancia/);
  });
  it("un recuento exacto actualiza stock y conserva el primer conteo",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const id=body.productos[0].id_producto;
    const r=await (await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,id,30)))).json();
    const payload={productos:[{id_producto:id,cantidad:48}]};
    for(let i=0;i<2;i++)expect((await (await recontar(request("/api/recontar",bodeguero,payload),contexto(r.id_recepcion))).json()).estado).toBe("APLICADA");
    expect(await stock(id)).toBe(48);
    const db=(await pool.query(`SELECT primer_conteo,conteo FROM compra_recepcion WHERE id_recepcion=$1`,[r.id_recepcion])).rows[0];
    expect(db.primer_conteo[0].cantidad_base).toBe(30);expect(db.conteo[0].cantidad_base).toBe(48);
  });
  it("rechazar una constancia no suma stock y permite una nueva recepción",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const id=body.productos[0].id_producto;
    const r=await (await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,id,1)))).json();
    await recontar(request("/api/recontar",bodeguero,{productos:[{id_producto:id,cantidad:1}],constancia:"Faltante"}),contexto(r.id_recepcion));
    expect((await resolver(request("/api/resolver",dueno,{accion:"rechazar",resolucion:"Se coordina nueva entrega."},"PATCH"),contexto(c.id_compra))).status).toBe(200);
    expect(await stock(id)).toBe(0);
    expect((await (await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,id,48)))).json()).estado).toBe("APLICADA");
    expect(await stock(id)).toBe(48);
  });
  it("no elige arbitrariamente entre compras compatibles",async()=>{
    const body=await nuevaCompra();await registrar(body);await registrar({...body,clave:randomUUID(),numero_factura:`F-${randomUUID()}`});
    const res=await recibir(request("/api/recepciones",bodeguero,entrada("",body.productos[0].id_producto,48)));
    expect(res.status).toBe(409);expect(await stock(body.productos[0].id_producto)).toBe(0);
  });
  it("rechaza entradas inválidas y revierte toda la compra ante una comparativa desactualizada",async()=>{
    const body=await nuevaCompra();Object.assign(body.productos[0],{venta_anterior:99});
    expect((await comprar(request("/api/compras",dueno,body))).status).toBe(409);
    expect((await pool.query(`SELECT 1 FROM compra WHERE clave=$1`,[body.clave])).rowCount).toBe(0);
    Object.assign(body.productos[0],{venta_anterior:5,cantidad:-1});
    expect((await comprar(request("/api/compras",dueno,body))).status).toBe(400);
  });
  it("colaboradores reciben en una bodega pero nunca consultan compras ni autorizan diferencias",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);
    for(const u of [empleado,bodeguero]) {
      expect((await listarCompras(request("/api/compras",u,undefined,"GET"))).status).toBe(403);
      expect((await comprar(request("/api/compras",u,body))).status).toBe(403);
      expect((await resolver(request("/api/resolver",u,{accion:"aprobar"},"PATCH"),contexto(c.id_compra))).status).toBe(403);
      expect((await pagar(request("/api/pagar",u,{}),contexto(c.id_compra))).status).toBe(403);
      expect((await entradaDirecta(request("/api/inventario/entrada",u,{}))).status).toBe(410);
    }
    expect((await recibir(request("/api/recepciones",empleado,entrada(c.ticket,body.productos[0].id_producto,48)))).status).toBe(200);
    expect(await stock(body.productos[0].id_producto,otraBodega)).toBe(48);
    const listado=await (await listarCompras(request("/api/compras",dueno,undefined,"GET"))).json();
    expect(listado.compras.some((x:{id_compra:number})=>x.id_compra===c.id_compra)).toBe(true);
  });
  it("dos recepciones simultáneas con distintas claves no duplican el ingreso",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const id=body.productos[0].id_producto;
    const res=await Promise.all([1,2].map(()=>recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,id,48)))));
    expect(res.map(r=>r.status).sort()).toEqual([200,409]);expect(await stock(id)).toBe(48);
    expect(Number((await pool.query(`SELECT COUNT(*) AS n FROM kardex WHERE id_producto=$1`,[id])).rows[0].n)).toBe(1);
  });
  it("recibe distintos productos de una compra en dos entradas sin marcar los omitidos como faltantes",async()=>{
    const body=await nuevaCompra();const extra=await nuevaCompra();body.productos.push(extra.productos[0]);
    const c=await registrar(body);const id=body.productos[0].id_producto;
    const r=await (await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,id,48)))).json();
    expect(r.estado).toBe("APLICADA");expect(await stock(id)).toBe(48);expect(await stock(extra.productos[0].id_producto)).toBe(0);
    expect((await pool.query(`SELECT estado FROM compra WHERE id_compra=$1`,[c.id_compra])).rows[0].estado).toBe('PARCIAL');
    const segundo=await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,extra.productos[0].id_producto,48)));
    expect((await segundo.json()).estado).toBe("APLICADA");expect(await stock(id)).toBe(48);expect(await stock(extra.productos[0].id_producto)).toBe(48);
    expect((await pool.query(`SELECT estado FROM compra WHERE id_compra=$1`,[c.id_compra])).rows[0].estado).toBe('RECIBIDA');
  });
  it("revierte precios y factura si una segunda línea es inválida",async()=>{
    const body=await nuevaCompra();const otra=await nuevaCompra();
    Object.assign(body.productos[0],{actualizar_precio:true,venta_nueva:8,mayoreo_nuevo:7});
    Object.assign(otra.productos[0],{costo:-1});body.productos.push(otra.productos[0]);
    expect((await comprar(request("/api/compras",dueno,body))).status).toBe(400);
    expect((await pool.query(`SELECT 1 FROM compra WHERE clave=$1`,[body.clave])).rowCount).toBe(0);
    expect((await pool.query(`SELECT precio_unitario FROM producto WHERE id_producto=$1`,[body.productos[0].id_producto])).rows[0].precio_unitario).toBe("5.00");
  });
  it("protege la unidad base de productos con compras pendientes",async()=>{
    const body=await nuevaCompra();await registrar(body);
    await expect(pool.query(`UPDATE producto SET unidad_medida='libra' WHERE id_producto=$1`,[body.productos[0].id_producto])).rejects.toMatchObject({code:"23514"});
  });
  it("el recuento solo puede realizarlo quien capturó la recepción",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const id=body.productos[0].id_producto;
    const r=await (await recibir(request("/api/recepciones",bodeguero,entrada(c.ticket,id,30)))).json();
    const res=await recontar(request("/api/recontar",empleado,{productos:[{id_producto:id,cantidad:48}]}),contexto(r.id_recepcion));
    expect(res.status).toBe(404);expect(await stock(id)).toBe(0);
  });
  it("acumula entregas del mismo producto sin duplicar y controla el saldo restante",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const id=body.productos[0].id_producto;
    const primera=entrada(c.ticket,id,20,null,{parcial:true});
    for(let i=0;i<2;i++)expect((await(await recibir(request('/api/recepciones',bodeguero,primera))).json()).estado).toBe('APLICADA');
    expect(await stock(id)).toBe(20);
    expect((await(await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,28)))).json()).estado).toBe('APLICADA');
    expect(await stock(id)).toBe(48);
    expect((await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,1)))).status).toBe(409);
  });
  it("una constancia pendiente de un producto no bloquea los demás",async()=>{
    const body=await nuevaCompra();const extra=await nuevaCompra();body.productos.push(extra.productos[0]);
    const c=await registrar(body);const id=body.productos[0].id_producto;
    const r=await(await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,40)))).json();
    await recontar(request('/api/recontar',bodeguero,{productos:[{id_producto:id,cantidad:40}],constancia:'Diferencia confirmada'}),contexto(r.id_recepcion));
    expect((await(await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,extra.productos[0].id_producto,48)))).json()).estado).toBe('APLICADA');
    expect(await stock(extra.productos[0].id_producto)).toBe(48);expect(await stock(id)).toBe(0);
    expect((await resolver(request('/api/resolver',dueno,{accion:'aprobar',id_recepcion:r.id_recepcion,resolucion:'Proveedor confirmó el faltante'},'PATCH'),contexto(c.id_compra))).status).toBe(200);
    expect(await stock(id)).toBe(40);expect((await pool.query(`SELECT estado FROM compra WHERE id_compra=$1`,[c.id_compra])).rows[0].estado).toBe('RECIBIDA');
  });
  it("aplica varios impuestos porcentuales sobre subtotal menos descuento y guarda su desglose",async()=>{
    const body=await nuevaCompra({descuento:6,transporte:10,impuestos_detalle:[{nombre:'Impuesto A',porcentaje:12},{nombre:'Impuesto B',porcentaje:2}]});
    const c=await registrar(body);const row=(await pool.query(`SELECT total,impuestos,impuestos_detalle FROM compra WHERE id_compra=$1`,[c.id_compra])).rows[0];
    expect(Number(row.impuestos)).toBe(12.6);expect(Number(row.total)).toBe(112.6);
    expect(row.impuestos_detalle).toEqual([{nombre:'Impuesto A',porcentaje:12,monto:10.8},{nombre:'Impuesto B',porcentaje:2,monto:1.8}]);
  });
  it("la tolerancia final se calcula sobre lo comprado, aun después de una entrega parcial",async()=>{
    const body=await nuevaCompra({tolerancia_porcentaje:5});const c=await registrar(body);const id=body.productos[0].id_producto;
    await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,40,null,{parcial:true})));
    const ultima=await(await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,6)))).json();
    expect(ultima.estado).toBe('APLICADA');expect(await stock(id)).toBe(46);
  });
  it("no cierra un producto con saldo pequeño si se indicó que llegará otra parte",async()=>{
    const body=await nuevaCompra({tolerancia_porcentaje:5});const c=await registrar(body);const id=body.productos[0].id_producto;
    await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,47,null,{parcial:true})));
    expect((await pool.query(`SELECT estado FROM compra WHERE id_compra=$1`,[c.id_compra])).rows[0].estado).toBe('PARCIAL');
    expect((await(await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,1)))).json()).estado).toBe('APLICADA');
    expect(await stock(id)).toBe(48);
  });
  it("acumula un mismo producto recibido en dos bodegas",async()=>{
    const body=await nuevaCompra();const c=await registrar(body);const id=body.productos[0].id_producto;
    await recibir(request('/api/recepciones',bodeguero,entrada(c.ticket,id,20,null,{parcial:true})));
    const segunda=await recibir(request('/api/recepciones',empleado,entrada(c.ticket,id,28)));
    expect((await segunda.json()).estado).toBe('APLICADA');expect(await stock(id)).toBe(20);expect(await stock(id,otraBodega)).toBe(28);
  });
});
