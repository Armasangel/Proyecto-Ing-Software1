import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

type Params = { params: { id: string } };

// HEAD/PUT /api/productos/:id — actualiza los datos básicos de un producto
// (queda igual que en el POST de /api/productos; id_proveedores y
// presentaciones solo se gestionan al crear, igual que en el frontend).
export async function PUT(req: NextRequest, { params }: Params) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const idProducto = Number(params.id);
  if (!Number.isInteger(idProducto) || idProducto < 1) {
    return validationError("Id de producto inválido");
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
    };

    if (!codigo_producto || !nombre_producto || !unidad_medida || !id_categoria || !id_marca) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existe = await client.query(`SELECT id_producto FROM producto WHERE id_producto = $1`, [
        idProducto,
      ]);
      if (existe.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      const result = await client.query(
        `UPDATE producto SET
           codigo_producto = $1,
           nombre_producto = $2,
           precio_unitario = $3,
           precio_mayoreo  = $4,
           unidad_medida   = $5,
           estado_producto = $6,
           caducidad       = $7,
           fecha_caducidad = $8,
           exento_iva      = $9,
           id_categoria    = $10,
           id_marca        = $11
         WHERE id_producto = $12
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
          idProducto,
        ]
      );

      await client.query("COMMIT");
      return NextResponse.json({ id_producto: result.rows[0].id_producto });
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
    return apiError("PRODUCTOS PUT", error);
  }
}

// DELETE /api/productos/:id — si el producto tiene historial (ventas, deudas,
// órdenes, kardex, proveedores o presentaciones) se desactiva (borrado
// lógico); si está totalmente limpio se elimina físicamente. El frontend
// muestra el aviso correspondiente según la respuesta { desactivado }.
export async function DELETE(req: NextRequest, { params }: Params) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const idProducto = Number(params.id);
  if (!Number.isInteger(idProducto) || idProducto < 1) {
    return validationError("Id de producto inválido");
  }

  try {
    const existe = await pool.query(`SELECT id_producto FROM producto WHERE id_producto = $1`, [
      idProducto,
    ]);
    if (existe.rowCount === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const historial = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM detalle_venta       WHERE id_producto = $1
         UNION ALL
         SELECT 1 FROM deuda_producto      WHERE id_producto = $1
         UNION ALL
         SELECT 1 FROM detalle_orden       WHERE id_producto = $1
         UNION ALL
         SELECT 1 FROM kardex              WHERE id_producto = $1
         UNION ALL
         SELECT 1 FROM producto_proveedor  WHERE id_producto = $1
         UNION ALL
         SELECT 1 FROM presentacion_producto WHERE id_producto = $1
         UNION ALL
         SELECT 1 FROM bodega_producto     WHERE id_producto = $1
       ) AS existe`,
      [idProducto]
    );

    if (historial.rows[0].existe) {
      await pool.query(`UPDATE producto SET estado_producto = FALSE WHERE id_producto = $1`, [
        idProducto,
      ]);
      return NextResponse.json({ ok: true, desactivado: true });
    }

    await pool.query(`DELETE FROM producto WHERE id_producto = $1`, [idProducto]);
    return NextResponse.json({ ok: true, desactivado: false });
  } catch (error) {
    return apiError("PRODUCTOS DELETE", error);
  }
}