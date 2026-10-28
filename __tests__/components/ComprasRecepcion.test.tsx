import { render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { RecepcionEntrada } from "@/components/compras/RecepcionEntrada";
import { ComprasStock } from "@/components/compras/ComprasStock";

const producto={id_producto:1,nombre_producto:"Arroz",codigo_producto:"ARR",unidad_medida:"unidad",precio_unitario:"5.00",precio_mayoreo:"4.00",costo_anterior:"2.00",
  presentaciones:[{id_presentacion:10,nombre_presentacion:"Caja de 24",factor_conversion:"24"}]};
const proveedor={id_proveedor:1,nombre_proveedor:"Distribuidora",nit_proveedor:"123",telefono:"5555",correo_contacto:"contacto@test.local"};
const datos={compras:[],avisos:[],productos:[producto],proveedores:[proveedor]};
const server=setupServer(
  rest.get("/api/productos",(_req,res,ctx)=>res(ctx.json({productos:[producto]}))),
  rest.get("/api/bodegas/simple",(_req,res,ctx)=>res(ctx.json({bodegas:[{id_bodega:1,nombre_bodega:"Bodega central"}]}))),
  rest.get("/api/presentaciones",(_req,res,ctx)=>res(ctx.json({presentaciones:producto.presentaciones}))),
  rest.get("/api/recepciones",(_req,res,ctx)=>res(ctx.json({recepciones:[],pendientes:[]}))),
  rest.get("/api/compras",(_req,res,ctx)=>res(ctx.json(datos))),
);
beforeAll(()=>server.listen({onUnhandledRequest:"error"}));
afterEach(()=>server.resetHandlers());
afterAll(()=>server.close());
type User=ReturnType<typeof userEvent.setup>;
async function escoger(user:User,label:string,busqueda:string,opcion:RegExp) {
  const campo=screen.getByLabelText(label);await waitFor(()=>expect(campo).toBeEnabled());
  await user.click(campo);await user.clear(campo);await user.type(campo,busqueda);
  await user.click(await screen.findByRole('option',{name:opcion}));
}
async function llenarCompra(user:User) {
  await waitFor(()=>expect(screen.getByRole('button',{name:'Registrar compra'})).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'Registrar compra'}));
  await escoger(user,'Proveedor','123',/Distribuidora/);
  await user.type(screen.getByLabelText('Número de factura *'),'F-1');
  await escoger(user,'Producto 1','ARR',/Arroz/);
  await escoger(user,'Presentación 1','Caja',/Caja de 24/);
  await user.type(screen.getByLabelText('Cantidad comprada *'),'2');
  await user.type(screen.getByLabelText('Precio de compra por Caja de 24 (Q) *'),'72');
}

it('captura a ciegas con búsqueda y conserva el segundo conteo sin datos de compra',async()=>{
  let primero:Record<string,unknown>|undefined;let segundo:Record<string,unknown>|undefined;
  server.use(
    rest.post('/api/recepciones',async(req,res,ctx)=>{primero=await req.json();return res(ctx.json({id_recepcion:12,estado:'RECONTAR',mensaje:'La cantidad no coincide.'}));}),
    rest.patch('/api/recepciones/12',async(req,res,ctx)=>{segundo=await req.json();return res(ctx.json({id_recepcion:12,estado:'PENDIENTE_DUENO',mensaje:'Constancia enviada al dueño.'}));}),
  );
  const user=userEvent.setup();render(<RecepcionEntrada idBodega={1}/>);
  await escoger(user,'Producto recibido 1','ARR',/Arroz/);
  await escoger(user,'Presentación recibida 1','Caja',/Caja de 24/);
  await user.type(screen.getByLabelText('Cantidad contada *'),'1');
  await user.click(screen.getByRole('button',{name:'Verificar recepción'}));
  await screen.findByRole('heading',{name:'Segundo conteo · recepción #12'});
  expect(screen.getByLabelText('Cantidad contada *')).toHaveValue(null);
  expect(primero?.productos).toEqual([{id_producto:1,id_presentacion:10,cantidad:'1'}]);
  await user.type(screen.getByLabelText('Cantidad contada *'),'1');
  await user.type(screen.getByLabelText('Constancia de recepción'),'Segundo conteo confirmado.');
  await user.click(screen.getByRole('button',{name:'Confirmar segundo conteo'}));
  await screen.findByText('Constancia enviada al dueño.');
  expect(segundo?.constancia).toBe('Segundo conteo confirmado.');
  expect(screen.queryByText(/Q |Margen|Precio|Factura|Distribuidora|Tolerancia/)).not.toBeInTheDocument();
});

it('compara por unidad, simplifica la ganancia y requiere confirmación antes de registrar',async()=>{
  let compra:Record<string,unknown>|undefined;
  server.use(rest.post('/api/compras',async(req,res,ctx)=>{compra=await req.json();return res(ctx.status(201),ctx.json({id_compra:8,ticket:'REC-ABC'}));}));
  const user=userEvent.setup();render(<ComprasStock onStockChange={jest.fn()}/>);
  await llenarCompra(user);await user.click(screen.getByRole('button',{name:'Comparar precios'}));
  expect(compra).toBeUndefined();
  expect(screen.getByText('Costo nuevo: Q 3.00 por unidad')).toBeInTheDocument();
  expect(screen.queryByText(/Recargo:/)).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Decisión de precios de Arroz'),'cambiar');
  await user.clear(screen.getByLabelText('Venta nueva (Q por unidad)'));await user.type(screen.getByLabelText('Venta nueva (Q por unidad)'),'6');
  expect(screen.getAllByText(/Margen: 50.00 %/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button',{name:'Confirmar compra y precios'}));
  await screen.findByText(/Compra registrada. Entrega el ticket REC-ABC/);
  expect(compra?.productos).toEqual([expect.objectContaining({id_producto:'1',id_presentacion:10,cantidad:'2',costo:'72',actualizar_precio:true,venta_nueva:'6',venta_anterior:'5.00'})]);
});

it('agrega múltiples impuestos porcentuales y actualiza total y costo de la comparativa',async()=>{
  const user=userEvent.setup();render(<ComprasStock onStockChange={jest.fn()}/>);
  await llenarCompra(user);
  for(const [i,tasa] of ['12','2'].entries()) {
    await user.click(screen.getByRole('button',{name:'Agregar impuesto'}));
    await user.type(screen.getByLabelText(`Nombre del impuesto ${i+1}`),`Tasa ${i+1}`);
    await user.type(screen.getByLabelText(`Porcentaje del impuesto ${i+1}`),tasa);
  }
  expect(screen.getByText('Total: Q 164.16')).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Comparar precios'}));
  expect(screen.getByText('Costo nuevo: Q 3.42 por unidad')).toBeInTheDocument();
});

it('muestra solo cinco sugerencias y encuentra productos y proveedores fuera de esa muestra',async()=>{
  const productos=Array.from({length:12},(_,i)=>({...producto,id_producto:i+1,nombre_producto:`Producto ${i+1}`,codigo_producto:`COD-${i+1}`}));
  const proveedores=Array.from({length:12},(_,i)=>({...proveedor,id_proveedor:i+1,nombre_proveedor:`Proveedor ${i+1}`,nit_proveedor:`NIT-${i+1}`}));
  server.use(rest.get('/api/compras',(_req,res,ctx)=>res(ctx.json({...datos,productos,proveedores}))));
  const user=userEvent.setup();render(<ComprasStock onStockChange={jest.fn()}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Registrar compra'})).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'Registrar compra'}));
  await user.click(screen.getByLabelText('Producto 1'));
  expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(5);
  await escoger(user,'Producto 1','COD-12',/Producto 12/);
  await user.click(screen.getByLabelText('Proveedor'));expect(within(screen.getByRole('listbox',{name:'Opciones de Proveedor'})).getAllByRole('option')).toHaveLength(5);
  await escoger(user,'Proveedor','NIT-12',/Proveedor 12/);
  expect(screen.getByLabelText('Proveedor')).toHaveValue('Proveedor 12 · NIT-12');
});

it('resalta la factura elegida y muestra los quintales comprados sin sustituirlos por libras',async()=>{
  const compra={id_compra:1,ticket:'REC-UNO',numero_factura:'F-UNO',proveedor_datos:proveedor,fecha_compra:'2026-10-21',condicion_pago:'CONTADO',estado:'PENDIENTE',subtotal:'5000',descuento:'0',impuestos:'0',transporte:'0',total:'5000',pagado:'5000',tolerancia_porcentaje:'0',recepciones:[],pagos:[],impuestos_detalle:[],productos:[{id_producto:1,nombre_producto:'Frijol',cantidad:'10',cantidad_base:'1000',unidad_base:'libra',nombre_presentacion:'Quintal',costo:'500',costo_base:'5',venta_anterior:'8',venta_nueva:'8'}]};
  server.use(rest.get('/api/compras',(_req,res,ctx)=>res(ctx.json({...datos,compras:[compra]}))));
  const user=userEvent.setup();render(<ComprasStock onStockChange={jest.fn()}/>);
  await user.click(await screen.findByRole('button',{name:'Ver'}));
  expect(screen.getByRole('button',{name:'Viendo factura'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('row',{name:/REC-UNO/})).toHaveAttribute('aria-selected','true');
  expect(screen.getByText('10 Quintal')).toBeInTheDocument();expect(screen.queryByText(/1000 libra/)).not.toBeInTheDocument();
});

it('limita el historial a cinco filas y mantiene aparte los recuentos pendientes',async()=>{
  const recepciones=Array.from({length:8},(_,i)=>({id_recepcion:i+1,id_bodega:1,estado:'APLICADA',conteo:[],nombre_bodega:'Central',creada_en:'2026-10-21T12:00:00Z'}));
  server.use(rest.get('/api/recepciones',(_req,res,ctx)=>res(ctx.json({recepciones,pendientes:[{...recepciones[0],id_recepcion:99,estado:'RECONTAR'}]}))));
  render(<RecepcionEntrada idBodega={1}/>);
  await screen.findByText('Recepción #1');expect(screen.getByText('Recepción #5')).toBeInTheDocument();
  expect(screen.queryByText('Recepción #6')).not.toBeInTheDocument();
  expect(within(screen.getByLabelText('Recuentos pendientes')).getByText('Recuento pendiente #99')).toBeInTheDocument();
});
