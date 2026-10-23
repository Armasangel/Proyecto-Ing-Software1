import { render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { ComprasStock } from "@/components/compras/ComprasStock";
import { sugerenciasPresentaciones } from "@/lib/presentaciones";

const existente={id_producto:1,nombre_producto:'Arroz',codigo_producto:'ARR',unidad_medida:'unidad',precio_unitario:'5.00',precio_mayoreo:'4.00',costo_anterior:null,presentaciones:[]};
const proveedor={id_proveedor:1,nombre_proveedor:'Distribuidora',nit_proveedor:'123',telefono:'5555',correo_contacto:'proveedor@test.local'};
let nuevo:Record<string,unknown>|null;
let altas:Record<string,unknown>[];
let compras:number;
let fallarCatalogo:boolean;
function datos() {return {compras:[],avisos:[],productos:[existente,...(nuevo?[nuevo]:[])],proveedores:[proveedor]};}
function registrar(body:Record<string,unknown>) {
  nuevo={...existente,...body,id_producto:99,costo_anterior:null,
    presentaciones:(body.presentaciones as {nombre_presentacion:string;factor_conversion:number}[]).map((p,i)=>({...p,id_presentacion:100+i,factor_conversion:String(p.factor_conversion)})),
  };
}
const server=setupServer(
  rest.get('/api/compras',(_req,res,ctx)=>fallarCatalogo&&nuevo?res(ctx.status(503),ctx.json({error:'Catálogo temporalmente no disponible'})):res(ctx.json(datos()))),
  rest.get('/api/productos',(_req,res,ctx)=>res(ctx.json({productos:datos().productos}))),
  rest.get('/api/proveedores',(_req,res,ctx)=>res(ctx.json({proveedores:[proveedor]}))),
  rest.get('/api/categorias',(_req,res,ctx)=>res(ctx.json({categorias:[{id_categoria:1,nombre_categoria:'Granos'},{id_categoria:2,nombre_categoria:'Básicos'},{id_categoria:3,nombre_categoria:'Nacionales'}]}))),
  rest.get('/api/marcas',(_req,res,ctx)=>res(ctx.json({marcas:[{id_marca:1,nombre_marca:'San Miguel'}]}))),
  rest.get('/api/presentaciones',(req,res,ctx)=>res(ctx.json({presentaciones:sugerenciasPresentaciones(req.url.searchParams.get('unidad_medida')||'unidad')}))),
  rest.post('/api/productos',async(req,res,ctx)=>{const body=await req.json();altas.push(body);registrar(body);return res(ctx.status(201),ctx.json({id_producto:99}));}),
  rest.post('/api/compras',(_req,res,ctx)=>{compras++;return res(ctx.status(201),ctx.json({id_compra:1,ticket:'REC-1'}));}),
);
beforeAll(()=>server.listen({onUnhandledRequest:'error'}));
beforeEach(()=>{nuevo=null;altas=[];compras=0;fallarCatalogo=false;});
afterEach(()=>server.resetHandlers());
afterAll(()=>server.close());
type User=ReturnType<typeof userEvent.setup>;
async function abrir(user:User,linea=1) {
  render(<ComprasStock onStockChange={jest.fn()}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Registrar compra'})).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'Registrar compra'}));
  await user.type(screen.getByLabelText('Proveedor'),'123');
  await user.click(await screen.findByRole('option',{name:/Distribuidora/}));
  await user.type(screen.getByLabelText('Número de factura *'),'F-PRUEBA');
  if(linea===2) {
    await user.type(screen.getByLabelText('Producto 1'),'ARR');
    await user.click(await screen.findByRole('option',{name:/Arroz/}));
    await user.click(screen.getByRole('button',{name:'Agregar producto'}));
  }
  const grupo=screen.getByRole('group',{name:`Producto ${linea}`});
  await user.type(within(grupo).getByLabelText('Cantidad comprada *'),'4');
  await user.type(within(grupo).getByLabelText('Precio de compra por unidad (Q) *'),'600');
  await user.click(screen.getByRole('button',{name:`+ Nuevo producto para la línea ${linea}`}));
  return screen.getByRole('dialog',{name:'Nuevo producto'});
}
async function completar(user:User,dialogo:HTMLElement) {
  const modal=within(dialogo);
  await user.type(modal.getByLabelText('Código del producto'),'FRJ-NUEVO');
  await user.type(modal.getByLabelText('Nombre del producto'),'Frijol nuevo');
  await user.type(modal.getByLabelText('Categoría principal *'),'Granos');
  await user.click(await modal.findByRole('option',{name:'Granos'}));
  await user.type(modal.getByLabelText('Marca'),'San Miguel');
  await user.click(await modal.findByRole('option',{name:'San Miguel'}));
  await user.type(modal.getByLabelText('Unidad de medida'),'libra');
}

it('crea con los campos del catálogo, selecciona la línea correcta y conserva la compra sin registrarla',async()=>{
  const user=userEvent.setup();const dialogo=await abrir(user,2);const modal=within(dialogo);
  await completar(user,dialogo);
  for(const [label,nombre] of [['Categoría 2 (opcional)','Básicos'],['Categoría 3 (opcional)','Nacionales']]) {
    await user.type(modal.getByLabelText(label),nombre);await user.click(await modal.findByRole('option',{name:nombre}));
  }
  await user.type(modal.getByLabelText('Precio unitario'),'8');await user.type(modal.getByLabelText('Precio mayoreo'),'6');
  await user.click(modal.getByLabelText('Producto con fecha de caducidad'));
  await user.type(modal.getByLabelText('Fecha de caducidad del producto'),'2027-01-01');
  await user.click(modal.getByLabelText('Exento de IVA'));
  expect(modal.getByRole('button',{name:'Quitar Quintal (100 libras)'})).toBeInTheDocument();
  await user.type(modal.getByRole('combobox',{name:'Buscar presentaciones'}),'media');
  await user.click(await modal.findByRole('option',{name:/Media libra/}));
  await user.click(modal.getByRole('button',{name:'Crear producto'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(()=>expect(screen.getByLabelText('Producto 2')).toHaveValue('Frijol nuevo (FRJ-NUEVO)'));
  expect(altas).toEqual([expect.objectContaining({codigo_producto:'FRJ-NUEVO',nombre_producto:'Frijol nuevo',id_categoria:1,id_categoria_2:2,id_categoria_3:3,id_marca:1,
    unidad_medida:'libra',precio_unitario:8,precio_mayoreo:6,caducidad:true,fecha_caducidad:'2027-01-01',exento_iva:true,estado_producto:true,id_proveedores:[1],
    presentaciones:expect.arrayContaining([expect.objectContaining({factor_conversion:100}),expect.objectContaining({factor_conversion:0.5})]),
  })]);
  expect(screen.getByLabelText('Producto 1')).toHaveValue('Arroz (ARR)');expect(screen.getByLabelText('Número de factura *')).toHaveValue('F-PRUEBA');
  const grupo=within(screen.getByRole('group',{name:'Producto 2'}));
  expect(grupo.getByLabelText('Cantidad comprada *')).toHaveValue(4);expect(grupo.getByLabelText('Precio de compra por libra (Q) *')).toHaveValue(600);
  await user.type(screen.getByLabelText('Presentación 2'),'quintal');expect(await screen.findByRole('option',{name:/Quintal/})).toBeInTheDocument();
  expect(compras).toBe(0);
},15000);

it('permite cancelar sin crear productos ni perder los datos de la compra',async()=>{
  const user=userEvent.setup();const dialogo=await abrir(user);
  await user.type(within(dialogo).getByLabelText('Código del producto'),'BORRADOR');
  await user.click(within(dialogo).getByRole('button',{name:'Cancelar'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(altas).toHaveLength(0);
  expect(screen.getByLabelText('Número de factura *')).toHaveValue('F-PRUEBA');expect(screen.getByLabelText('Cantidad comprada *')).toHaveValue(4);
});

it('mantiene el formulario y sus datos ante un código duplicado, y permite corregirlo',async()=>{
  server.use(rest.post('/api/productos',async(req,res,ctx)=>{
    const body=await req.json();altas.push(body);
    if(body.codigo_producto==='FRJ-NUEVO')return res(ctx.status(409),ctx.json({error:'El código de producto ya existe'}));
    registrar(body);return res(ctx.status(201),ctx.json({id_producto:99}));
  }));
  const user=userEvent.setup();const dialogo=await abrir(user);await completar(user,dialogo);const modal=within(dialogo);
  await user.click(modal.getByRole('button',{name:'Crear producto'}));
  expect(await modal.findByRole('alert')).toHaveTextContent('El código de producto ya existe');
  expect(modal.getByLabelText('Nombre del producto')).toHaveValue('Frijol nuevo');
  await user.clear(modal.getByLabelText('Código del producto'));await user.type(modal.getByLabelText('Código del producto'),'FRJ-OTRO');
  await user.click(modal.getByRole('button',{name:'Crear producto'}));
  await waitFor(()=>expect(screen.getByLabelText('Producto 1')).toHaveValue('Frijol nuevo (FRJ-OTRO)'));
  expect(altas).toHaveLength(2);expect(compras).toBe(0);
});

it('recupera la selección tras un fallo al actualizar sin volver a crear el producto',async()=>{
  const user=userEvent.setup();const dialogo=await abrir(user);await completar(user,dialogo);fallarCatalogo=true;
  await user.click(within(dialogo).getByRole('button',{name:'Crear producto'}));
  await screen.findByText('Catálogo temporalmente no disponible');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(altas).toHaveLength(1);
  expect(screen.getByRole('button',{name:'Comparar precios'})).toBeDisabled();
  fallarCatalogo=false;await user.click(screen.getByRole('button',{name:'Actualizar'}));
  await waitFor(()=>expect(screen.getByLabelText('Producto 1')).toHaveValue('Frijol nuevo (FRJ-NUEVO)'));
  expect(altas).toHaveLength(1);expect(compras).toBe(0);
});
