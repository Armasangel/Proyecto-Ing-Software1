import { calcularImpuestos, costoUnitarioCompra, compararRecepcion, margen, recargo, numero, fecha, type Conteo } from "@/lib/compras";
const esperados=[{id_producto:1,cantidad_base:"100.000",unidad_base:"unidad"}];
const contar=(cantidad:number,unidad="unidad"):Conteo[]=>[{id_producto:1,cantidad,cantidad_base:cantidad,unidad_base:unidad,id_presentacion:null,nombre_presentacion:null,factor_conversion:1}];

it("distingue margen sobre venta y recargo sobre costo",()=>{
  expect(margen(10,6)).toBe(40);expect(recargo(10,6)).toBeCloseTo(66.6667);
  expect(margen(0,6)).toBeNull();expect(recargo(10,0)).toBeNull();expect(margen(10,null)).toBeNull();
});
it.each([95,105])("acepta el límite de tolerancia tanto en faltantes como en excedentes: %s",n=>{
  expect(compararRecepcion(esperados,contar(n),5)).toMatchObject({coincide:false,aceptable:true});
});
it.each([94.999,105.001])("rechaza diferencias más allá de la tolerancia: %s",n=>{
  expect(compararRecepcion(esperados,contar(n),5).aceptable).toBe(false);
});
it("no esconde productos faltantes, extras ni unidades incompatibles",()=>{
  expect(compararRecepcion(esperados,[],0)).toMatchObject({coincide:false,aceptable:false});
  expect(compararRecepcion(esperados,[...contar(100),{...contar(1)[0],id_producto:2}],0).aceptable).toBe(false);
  expect(compararRecepcion(esperados,contar(100,"libra"),100)).toMatchObject({coincide:false,aceptable:false});
});
it("valida cantidades finitas, precisión y fechas de calendario",()=>{
  for(const n of [NaN,Infinity,-1,null,true,"",0.0001])expect(()=>numero(n,"Cantidad")).toThrow();
  expect(numero("1.125","Cantidad")).toBe(1.125);
  expect(()=>fecha("2026-02-30","Compra")).toThrow();expect(fecha("2028-02-29","Compra")).toBe("2028-02-29");
});
it("convierte quintales a libras en la primera compra y al cambiar de presentación",()=>{
  expect(costoUnitarioCompra(10,500,100,5000,5000)).toBe(5);
  expect(costoUnitarioCompra(1000,5,1,5000,5000)).toBe(5);
  expect(costoUnitarioCompra(20,250,50,5000,5000)).toBe(5);
});
it("suma tasas independientes sobre el subtotal neto y redondea cada impuesto",()=>{
  expect(calcularImpuestos(100,10,[{nombre:'A',porcentaje:12},{nombre:'B',porcentaje:2}])).toEqual([
    {nombre:'A',porcentaje:12,monto:10.8},{nombre:'B',porcentaje:2,monto:1.8},
  ]);
});
