import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { esUnidadDeVolumen, normalizarUnidad, validarPresentaciones, type Presentacion } from "@/lib/presentaciones";
import { guardarPresentaciones, PresentacionError } from "@/lib/producto-presentaciones";
import { validarCategoriasProducto } from "@/lib/producto-categorias";

type Params = { params: Promise<{ id: string }> };

// Datos y presentaciones se guardan juntos para no dejar cambios parciales.
export async function PUT(req: NextRequest, { params }: Params) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const { id } = await params;
  const idProducto = Number(id);
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
      id_categoria_2,
      id_categoria_3,
      id_marca,
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
      id_categoria_2?: number | null;
      id_categoria_3?: number | null;
      id_marca: number;
      presentaciones?: Presentacion[];
    };

    if (!codigo_producto || !nombre_producto || !unidad_medida || !id_categoria || !id_marca) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (esUnidadDeVolumen(unidad_medida)) return validationError("Los líquidos se registran por botella. Usa botella como unidad base y un producto distinto para cada tamaño.");
    if (presentaciones !== undefined) {
      if (!isDuenoTipo(usuario.tipo_usuario)) return unauthorizedError();
      const error = validarPresentaciones(presentaciones);
      if (error) return validationError(error);
    }
    const errorCategorias = validarCategoriasProducto([id_categoria, id_categoria_2 ?? null, id_categoria_3 ?? null]);
    if (errorCategorias) return validationError(errorCategorias);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existe = await client.query(`SELECT id_producto, unidad_medida, id_categoria_2, id_categoria_3 FROM producto WHERE id_producto = $1 FOR UPDATE`, [
        idProducto,
      ]);
      if (existe.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }
      // Los clientes que omiten las categorías adicionales conservan sus valores.
      const categoria2 = id_categoria_2 === undefined ? existe.rows[0].id_categoria_2 ?? null : id_categoria_2;
      const categoria3 = id_categoria_3 === undefined ? existe.rows[0].id_categoria_3 ?? null : id_categoria_3;
      const errorCategoriasFinal = validarCategoriasProducto([id_categoria, categoria2, categoria3]);
      if (errorCategoriasFinal) {
        await client.query("ROLLBACK");
        return validationError(errorCategoriasFinal);
      }
      if (normalizarUnidad(existe.rows[0].unidad_medida) !== normalizarUnidad(unidad_medida)) {
        if (!isDuenoTipo(usuario.tipo_usuario) || presentaciones === undefined) {
          await client.query("ROLLBACK");
          return validationError("Para cambiar la unidad base, el dueño debe seleccionar las presentaciones de la nueva unidad en la edición del producto.");
        }
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
           id_marca        = $11,
           id_categoria_2  = $13,
           id_categoria_3  = $14
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
          categoria2,
          categoria3,
        ]
      );

      if (presentaciones !== undefined) await guardarPresentaciones(client, idProducto, presentaciones, unidad_medida);
      await client.query("COMMIT");
      return NextResponse.json({ id_producto: result.rows[0].id_producto });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error.code === "23503") return validationError("La categoría o marca seleccionada no existe");
    if (error instanceof PresentacionError) return validationError(error.message);
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

  const { id } = await params;
  const idProducto = Number(id);
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
