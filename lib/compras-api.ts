import { NextResponse } from "next/server";
import { CompraError } from "@/lib/compras";
import { apiError } from "@/lib/api-error";

export function errorCompra(contexto: string, e: unknown) {
  if (e instanceof CompraError) return NextResponse.json({ error:e.message },{status:e.status});
  if (e instanceof SyntaxError) return NextResponse.json({error:"Formulario inválido."},{status:400});
  if ((e as {code?:string})?.code === "23505") return NextResponse.json({error:"La factura o la operación ya fue registrada."},{status:409});
  return apiError(contexto,e);
}
