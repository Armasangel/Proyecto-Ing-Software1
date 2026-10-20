import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";
import { presentacionesIniciales, validarPresentaciones, type Presentacion } from "@/lib/presentaciones";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !(isStaffTipo(usuario.tipo_usuario) || isBodegueroTipo(usuario.tipo_usuario))) {
    return unauthorizedError();
  }
  try {
    const result = await pool.query(`
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.precio_unitario,
        p.precio_mayoreo,
        p.unidad_medida,
        p.estado_producto,
        p.caducidad,
        p.fecha_caducidad,
        p.exento_iva,
        p.id_categoria,
        p.id_marca,
        c.nombre_categoria,
        m.nombre_marca
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN marca     m ON m.id_marca     = p.id_marca
      ORDER BY p.nombre_producto
    `);
    return NextResponse.json({ productos: result.rows });
  } catch (error) {
    return apiError("PRODUCTOS GET", error);
  }
}

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  try {
    const body = await req.json();
    const {
      codigo_producto,
      nombre_producto,
      precio_unitario,
      precio_mayoreo,
      unidad_medida,
      estado_producto = true,
      caducidad = false,
      fecha_caducidad = null,
      exento_iva = false,
      id_categoria,
      id_marca,
      id_proveedores = [],
      presentaciones,
    } = body as {
      codigo_producto: string;
      nombre_producto: string;
      precio_unitario?: number | null;
      precio_mayoreo?: number | null;
      unidad_medida: string;
      estado_producto?: boolean;
      caducidad?: boolean;
      fecha_caducidad?: string | null;
      exento_iva?: boolean;
      id_categoria: number;
      id_marca: number;
      id_proveedores?: number[];
      presentaciones?: Presentacion[];
    };

    if (!codigo_producto || !nombre_producto || !unidad_medida || !id_categoria || !id_marca) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const presentacionesLimpias = presentaciones === undefined ? presentacionesIniciales(unidad_medida) : presentaciones;
    const errorPresentaciones = validarPresentaciones(presentacionesLimpias);
    if (errorPresentaciones) return NextResponse.json({ error: errorPresentaciones }, { status: 400 });
    if (presentacionesLimpias.some((p) => p.id_presentacion !== undefined)) {
      return NextResponse.json({ error: "Las presentaciones de otro producto deben seleccionarse como nuevas equivalencias." }, { status: 400 });
    }

    const idProveedores = (Array.isArray(id_proveedores) ? id_proveedores : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO producto (
          codigo_producto, nombre_producto, precio_unitario, precio_mayoreo,
          unidad_medida, estado_producto, caducidad, fecha_caducidad, exento_iva, id_categoria, id_marca
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id_producto`,
        [
          codigo_producto,
          nombre_producto,
          precio_unitario || null,
          precio_mayoreo || null,
          unidad_medida,
          estado_producto,
          caducidad,
          caducidad ? fecha_caducidad || null : null,
          exento_iva,
          id_categoria,
          id_marca,
        ]
      );
      const idProducto = result.rows[0].id_producto;

      for (const idProveedor of idProveedores) {
        await client.query(
          `INSERT INTO producto_proveedor (id_producto, id_proveedor)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [idProducto, idProveedor]
        );
      }

      for (const pres of presentacionesLimpias) {
        await client.query(
          `INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_producto, nombre_presentacion) DO NOTHING`,
          [idProducto, pres.nombre_presentacion.trim(), pres.factor_conversion]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ id_producto: idProducto }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "El código de producto ya existe" }, { status: 409 });
    }
    return apiError("PRODUCTOS POST", error);
  }
}
