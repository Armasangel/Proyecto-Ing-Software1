import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo, TIPOS_USUARIO } from "@/lib/roles";

// Ventana de tiempo dentro de la cual una venta puede deshacerse. La UI
// solo muestra el botón "Deshacer" ~60s tras registrar la venta, pero acá
// dejamos un margen más generoso como red de seguridad del lado servidor
// (por si la persona tarda en hacer clic, hay lag de red, etc.) sin volverse
// una vía para anular ventas viejas por esta ruta — para eso existe el
// cambio de estado manual explícito en Reportes/Ventas.
const VENTANA_DESHACER_MINUTOS = 10;

// POST /api/ventas/:id/anular — deshace una venta reciente.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id_venta = Number(params.id);
  if (!Number.isInteger(id_venta)) {
    return NextResponse.json({ error: "Id de venta inválido" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ventaRes = await client.query(
      `SELECT id_venta, id_empleado, estado_venta, fecha_venta
       FROM venta WHERE id_venta = $1 FOR UPDATE`,
      [id_venta]
    );
    if (ventaRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "La venta no existe" }, { status: 404 });
    }
    const venta = ventaRes.rows[0];

    // Un colaborador solo puede deshacer sus propias ventas; el dueño
    // puede deshacer cualquiera (por si necesita corregir algo).
    if (usuario.tipo_usuario === TIPOS_USUARIO.EMPLEADO && venta.id_empleado !== usuario.id_usuario) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Solo podés deshacer tus propias ventas" }, { status: 403 });
    }

    if (venta.estado_venta === "CANCELADO") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Esta venta ya está cancelada" }, { status: 400 });
    }

    const minutosTranscurridos =
      (Date.now() - new Date(venta.fecha_venta).getTime()) / 60000;
    if (minutosTranscurridos > VENTANA_DESHACER_MINUTOS) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: `Ya pasaron más de ${VENTANA_DESHACER_MINUTOS} minutos desde esta venta — para anularla, cambiá su estado manualmente en Reportes.`,
        },
        { status: 400 }
      );
    }

    const detalleRes = await client.query(
      `SELECT id_producto, id_bodega, cantidad FROM detalle_venta WHERE id_venta = $1`,
      [id_venta]
    );
    if (detalleRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "La venta no tiene productos registrados" }, { status: 400 });
    }

    const sinBodega = detalleRes.rows.some((r) => r.id_bodega === null);
    if (sinBodega) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Esta venta es de antes de que existiera la función de deshacer, no se puede revertir automáticamente." },
        { status: 400 }
      );
    }

    for (const linea of detalleRes.rows) {
      await client.query(
        `UPDATE bodega_producto SET cantidad_disponible = cantidad_disponible + $1, ultima_actualizacion = NOW()
         WHERE id_bodega = $2 AND id_producto = $3`,
        [linea.cantidad, linea.id_bodega, linea.id_producto]
      );
      await client.query(
        `INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion)
         VALUES ($1, $2, 'ENTRADA', $3, $4)`,
        [linea.id_bodega, linea.id_producto, linea.cantidad, `Venta #${id_venta} deshecha`]
      );
    }

    await client.query(`UPDATE venta SET estado_venta = 'CANCELADO' WHERE id_venta = $1`, [id_venta]);

    await client.query("COMMIT");
    return NextResponse.json({ mensaje: "Venta deshecha, el stock fue restaurado.", id_venta });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[VENTAS ANULAR]", error);
    return NextResponse.json({ error: "No se pudo deshacer la venta" }, { status: 500 });
  } finally {
    client.release();
  }
}
