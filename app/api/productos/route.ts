import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

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

// Unidades cuyo nombre sugiere un líquido embotellado: para estas, el
// producto SI O SI debe quedar con al menos una presentación tipo "caja"
// (de lo contrario nadie podría vender/trasladar por mayor de forma
// consistente). Se valida también aquí en el servidor, no solo en el
// formulario, para que no se pueda saltar con una llamada directa a la API.
const UNIDADES_LIQUIDAS = ["botella", "litro", "lt", "ml", "galon", "galón"];

function esUnidadLiquida(unidad: string): boolean {
  const u = unidad.trim().toLowerCase();
  return UNIDADES_LIQUIDAS.some((k) => u.includes(k));
}

type PresentacionInput = { nombre_presentacion: string; factor_conversion: number };

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
      presentaciones = [],
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
      presentaciones?: PresentacionInput[];
    };

    if (!codigo_producto || !nombre_producto || !unidad_medida || !id_categoria || !id_marca) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const presentacionesLimpias = (Array.isArray(presentaciones) ? presentaciones : [])
      .map((p) => ({
        nombre_presentacion: String(p?.nombre_presentacion ?? "").trim(),
        factor_conversion: Number(p?.factor_conversion),
      }))
      .filter((p) => p.nombre_presentacion && p.factor_conversion > 0);

    if (esUnidadLiquida(unidad_medida) && presentacionesLimpias.length === 0) {
      return NextResponse.json(
        {
          error:
            "Los productos con unidad de medida líquida (botella, litro, ml, galón) deben tener al menos una presentación tipo caja definida (ej. 'Caja de 24').",
        },
        { status: 400 }
      );
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
          [idProducto, pres.nombre_presentacion, pres.factor_conversion]
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
