// app/api/bodegas/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id_bodega, nombre_bodega, ubicacion FROM bodega ORDER BY nombre_bodega`
    );
    return NextResponse.json({ bodegas: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar bodegas", detalle: String(error) },
      { status: 500 }
    );
  }
}