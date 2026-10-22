// app/api/ventas/route.ts  (solo el GET cambia — POST idéntico al fix del bug #3)
//   GET /api/ventas              -> página 1, 50 registros
//   GET /api/ventas?page=2       -> página 2, 50 registros
//   GET /api/ventas?limit=20     -> página 1, 20 registros
//   GET /api/ventas?page=1&limit=100 -> máximo permitido

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { getLogger } from "@/lib/logger";
import { recalcularBloqueoCliente, verificarLimiteAntesDeDeuda } from "@/lib/deuda-alertas";
import {
  diferenciaDias,
  esFechaISO,
  generarCuotas,
  validarCondicionesCredito,
  type Cuota,
} from "@/lib/credito";
import {
  cargarDescuentosAplicables,
  elegirMejorDescuento,
  type Descuento,
} from "@/lib/descuentos";
import {
  esTipoDocumento,
  prefijoTipoDocumento,
  type TipoDocumento,
} from "@/lib/tipos-documento";

const log = getLogger("api/ventas");

const ESTADOS_VENTA = ["PENDIENTE", "CONFIRMADO", "ENTREGADO", "PAGADO"] as const;
const TIPOS_VENTA = ["MINORISTA", "MAYORISTA"] as const;
const TIPOS_ENTREGA = ["EN_TIENDA", "DOMICILIO"] as const;
const CONDICIONES_PAGO = ["CONTADO", "CREDITO"] as const;

// La fecha de factura de una venta a crédito puede ser anterior (se registra
// tarde) pero no más de un año atrás, ni futura. Se tolera 1 día hacia adelante
// porque el servidor puede estar en otra zona horaria que quien vende.
const MAX_DIAS_ATRAS_FACTURA = 365;
const MAX_DIAS_ADELANTE_FACTURA = 1;

type EstadoVenta = (typeof ESTADOS_VENTA)[number];
type TipoVenta = (typeof TIPOS_VENTA)[number];
type TipoEntrega = (typeof TIPOS_ENTREGA)[number];

function isEstadoVenta(s: string): s is EstadoVenta {
  return (ESTADOS_VENTA as readonly string[]).includes(s);
}
function isTipoVenta(s: string): s is TipoVenta {
  return (TIPOS_VENTA as readonly string[]).includes(s);
}
function isTipoEntrega(s: string): s is TipoEntrega {
  return (TIPOS_ENTREGA as readonly string[]).includes(s);
}

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // FIX #8: paginación real
  const { searchParams } = req.nextUrl;
  const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  try {
    // Total para metadata de paginación
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM venta`
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.id_cliente,
        v.id_empleado,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.total,
        v.fecha_limite_pago,
        v.condicion_pago,
        o.id_orden,
        o.estado AS estado_pedido,
        uc.nombre AS nombre_cliente,
        uc.correo AS correo_cliente,
        uc.codigo_cliente,
        uc.nit_cliente,
        ue.nombre AS nombre_colaborador,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', dv.id_detalle_venta,
              'id_venta', dv.id_venta,
              'codigo_producto', p.codigo_producto,
              'id_producto', dv.id_producto,
              'cantidad', dv.cantidad,
              'precio_unitario_venta', dv.precio_unitario,
              'subtotal', dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      JOIN cliente uc ON uc.id_cliente = v.id_cliente
      LEFT JOIN usuario ue ON ue.id_usuario = v.id_empleado
      LEFT JOIN orden o ON o.id_venta = v.id_venta
      LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      LEFT JOIN producto p ON p.id_producto = dv.id_producto
      GROUP BY
        v.id_venta, v.id_cliente, v.id_empleado, v.fecha_venta,
        v.estado_venta, v.tipo_venta, v.tipo_entrega, v.direccion_entrega,
        v.total, v.fecha_limite_pago, v.condicion_pago, o.id_orden, o.estado,
        uc.nombre, uc.correo, uc.codigo_cliente, uc.nit_cliente, ue.nombre
      ORDER BY v.fecha_venta DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return NextResponse.json({
      ventas: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error al consultar ventas [GET]");
    return NextResponse.json(
      { error: "Error al consultar ventas" },
      { status: 500 }
    );
  }
}

type LineaInput = {
  id_producto: number;
  id_bodega: number;
  // En unidades de la presentación si id_presentacion viene (ej. 3 "Caja de
  // 24"); en unidad base si no.
  cantidad: number;
  // Precio por unidad BASE del producto.
  precio_unitario_venta: number;
  id_presentacion: number | null;
};

export async function POST(request: NextRequest) {
  const usuario = getUsuarioFromRequest(request);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      id_cliente: idCliente,
      estado_pago,
      estado_venta: estadoVentaBody,
      tipo_venta,
      forzar_tipo_venta: forzarTipoVentaBody,
      tipo_entrega,
      direccion_entrega,
      fecha_limite_pago,
      lineas,
      condicion_pago,
      credito,
    } = body;

    // condicion_pago es opcional por compatibilidad: sin ella la venta se
    // comporta como siempre (usa estado_pago). Con "CONTADO" la venta queda
    // pagada en el acto; con "CREDITO" se genera la factura y la cuenta por
    // cobrar con su plan de cuotas.
    if (condicion_pago !== undefined && !(CONDICIONES_PAGO as readonly unknown[]).includes(condicion_pago)) {
      return NextResponse.json({ error: "condicion_pago debe ser CONTADO o CREDITO" }, { status: 400 });
    }
    const esCredito = condicion_pago === "CREDITO";

    let plazoDias = 0;
    let numeroCuotas = 0;
    let fechaFacturaBody: string | null = null;
    let tipoDocumento: TipoDocumento = "FACTURA";
    if (esCredito) {
      const c = (credito ?? {}) as Record<string, unknown>;
      const errorCredito = validarCondicionesCredito(c.plazo_dias, c.numero_cuotas);
      if (errorCredito) {
        return NextResponse.json({ error: errorCredito }, { status: 400 });
      }
      plazoDias = c.plazo_dias as number;
      numeroCuotas = c.numero_cuotas as number;
      if (c.fecha_factura !== undefined && c.fecha_factura !== null && c.fecha_factura !== "") {
        if (!esFechaISO(c.fecha_factura)) {
          return NextResponse.json({ error: "La fecha de factura debe tener formato AAAA-MM-DD" }, { status: 400 });
        }
        fechaFacturaBody = c.fecha_factura;
      }
      if (c.tipo_documento !== undefined && c.tipo_documento !== null) {
        if (!esTipoDocumento(c.tipo_documento)) {
          return NextResponse.json(
            { error: "tipo_documento debe ser FACTURA o FACTURA_CAMBIARIA" },
            { status: 400 }
          );
        }
        tipoDocumento = c.tipo_documento;
      }
    }

    const estadoRaw = esCredito ? "CONFIRMADO" : condicion_pago === "CONTADO" ? "PAGADO" : estado_pago ?? estadoVentaBody;
    if (typeof estadoRaw !== "string" || !isEstadoVenta(estadoRaw)) {
      return NextResponse.json(
        { error: "estado_pago / estado_venta inválido. Use: PENDIENTE, CONFIRMADO, ENTREGADO o PAGADO" },
        { status: 400 }
      );
    }
    const estado_venta = estadoRaw;

    // tipo_venta ya NO lo elige el colaborador a mano: se detecta
    // automáticamente a partir del tipo_cliente guardado en la base (ver
    // más abajo, una vez confirmado que el cliente existe). Solo se respeta
    // el tipo_venta que venga en el body si forzar_tipo_venta viene en
    // true — para el caso excepcional de una venta que a propósito no
    // coincide con el tipo habitual de ese cliente.
    const forzarTipoVenta = forzarTipoVentaBody === true;
    if (forzarTipoVenta && (typeof tipo_venta !== "string" || !isTipoVenta(tipo_venta))) {
      return NextResponse.json(
        { error: "Al forzar el tipo de venta, tipo_venta debe ser MINORISTA o MAYORISTA" },
        { status: 400 }
      );
    }

    if (typeof tipo_entrega !== "string" || !isTipoEntrega(tipo_entrega)) {
      return NextResponse.json({ error: "tipo_entrega debe ser EN_TIENDA o DOMICILIO" }, { status: 400 });
    }

    const direccion = typeof direccion_entrega === "string" ? direccion_entrega.trim() : "";
    if (tipo_entrega === "DOMICILIO" && !direccion) {
      return NextResponse.json({ error: "La dirección de entrega es obligatoria para domicilio" }, { status: 400 });
    }

    if (!idCliente || Number(idCliente) < 1) {
      return NextResponse.json({ error: "Debe seleccionar un cliente" }, { status: 400 });
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return NextResponse.json({ error: "Agregue al menos un producto a la venta" }, { status: 400 });
    }

    const lineasNorm: LineaInput[] = [];
    for (const L of lineas as unknown[]) {
      if (!L || typeof L !== "object") continue;
      const o = L as Record<string, unknown>;
      const id_producto = Number(o.id_producto);
      const id_bodega = Number(o.id_bodega);
      const cantidad = Number(o.cantidad);
      const precio_unitario_venta = Number(o.precio_unitario_venta);
      if (!id_producto || !id_bodega || cantidad <= 0 || precio_unitario_venta < 0) {
        return NextResponse.json(
          { error: "Cada línea requiere id_producto, id_bodega, cantidad > 0 y precio válido" },
          { status: 400 }
        );
      }
      lineasNorm.push({
        id_producto,
        id_bodega,
        cantidad,
        precio_unitario_venta,
        id_presentacion: o.id_presentacion ? Number(o.id_presentacion) : null,
      });
    }

    if (lineasNorm.length === 0) {
      return NextResponse.json({ error: "Líneas de venta inválidas" }, { status: 400 });
    }

    let fechaLimite: string | null = null;
    if (fecha_limite_pago != null && String(fecha_limite_pago).trim() !== "") {
      fechaLimite = String(fecha_limite_pago).trim();
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existeCliente = await client.query<{
        tipo_cliente: string;
        nombre?: string;
        telefono?: string | null;
        nit_cliente?: string | null;
        direccion?: string | null;
        es_consumidor_final?: boolean;
      }>(
        `SELECT tipo_cliente, nombre, telefono, nit_cliente, direccion, es_consumidor_final
         FROM cliente WHERE id_cliente = $1 AND estado_cliente = TRUE`, [idCliente]
      );
      if (existeCliente.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
      }

      // Consumidor Final es un cliente anónimo: no hay a quién cobrarle, así
      // que las ventas a crédito con este cliente se rechazan.
      if (esCredito && existeCliente.rows[0].es_consumidor_final) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Consumidor Final no puede comprar a crédito; registre la venta como Contado" },
          { status: 400 }
        );
      }

      const datosCliente = existeCliente.rows[0];
      const nitCliente = (datosCliente.nit_cliente || "CF").trim() || "CF";
      const direccionCliente =
        typeof datosCliente.direccion === "string" ? datosCliente.direccion.trim() : "";

      // La factura cambiaria usa los datos ampliados del cliente: NIT real y
      // dirección. Se valida acá, antes de tocar stock o crear la venta.
      if (esCredito && tipoDocumento === "FACTURA_CAMBIARIA") {
        if (nitCliente.toUpperCase() === "CF") {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "La factura cambiaria requiere que el cliente tenga un NIT registrado" },
            { status: 400 }
          );
        }
        if (!direccionCliente) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "La factura cambiaria requiere que el cliente tenga una dirección registrada" },
            { status: 400 }
          );
        }
      }

      // Detección automática del tipo de venta: por defecto es el
      // tipo_cliente que ya tiene guardado el cliente (MINORISTA/MAYORISTA),
      // no lo que haya mandado el formulario. Solo se usa lo que mandó el
      // formulario cuando viene forzar_tipo_venta = true.
      const tipoClienteDetectado = existeCliente.rows[0].tipo_cliente;
      const tipoVentaFinal: TipoVenta =
        forzarTipoVenta && typeof tipo_venta === "string" && isTipoVenta(tipo_venta)
          ? tipo_venta
          : isTipoVenta(tipoClienteDetectado)
          ? tipoClienteDetectado
          : "MINORISTA";

      const bodegasUnicas = [...new Set(lineasNorm.map((ln) => ln.id_bodega))];
      const existeBodegas = await client.query(
        `SELECT id_bodega FROM bodega WHERE id_bodega = ANY($1)`,
        [bodegasUnicas]
      );
      if (existeBodegas.rowCount !== bodegasUnicas.length) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Una o más bodegas no fueron encontradas" }, { status: 400 });
      }

      let total = 0;
      let descuentoTotal = 0;
      const prepared: Array<{
        id_producto: number;
        id_bodega: number;
        cantidad: number; // siempre en unidad base
        precio: number;
        subtotal: number; // NETO (ya con el descuento restado)
        descuento_porcentaje: number;
        descuento_monto: number;
        id_descuento: number | null;
        descuento_nombre: string | null;
        id_presentacion: number | null;
        cantidad_presentacion: number | null;
      }> = [];

      // Reglas de descuento activas para este cliente (por cliente o por su
      // tipo_cliente). Se cargan una sola vez dentro de la transacción.
      const descuentosAplicables: Descuento[] = await cargarDescuentosAplicables(
        client,
        Number(idCliente),
        tipoClienteDetectado
      );

      for (const ln of lineasNorm) {
        const prod = await client.query(
          `SELECT id_producto, estado_producto FROM producto WHERE id_producto = $1`, [ln.id_producto]
        );
        if (prod.rowCount === 0 || !prod.rows[0].estado_producto) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: `Producto no disponible: id ${ln.id_producto}` }, { status: 400 });
        }

        // Presentación de mayoreo (ej. "Caja de 24"): la cantidad capturada se
        // convierte a unidad base con su factor; stock, kardex y detalle
        // siempre trabajan en unidad base.
        let cantidadBase = ln.cantidad;
        let cantidadPresentacion: number | null = null;
        if (ln.id_presentacion) {
          const pres = await client.query(
            `SELECT factor_conversion FROM presentacion_producto
             WHERE id_presentacion = $1 AND id_producto = $2 AND estado_presentacion = TRUE`,
            [ln.id_presentacion, ln.id_producto]
          );
          if (pres.rowCount === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { error: `Presentación inválida para el producto id ${ln.id_producto}` },
              { status: 400 }
            );
          }
          cantidadPresentacion = ln.cantidad;
          cantidadBase = ln.cantidad * Number(pres.rows[0].factor_conversion);
        }

        const subQ = await client.query(
          `SELECT ROUND(($1::numeric * $2::numeric), 2) AS sub`, [cantidadBase, ln.precio_unitario_venta]
        );
        const subtotalBruto = Number(subQ.rows[0].sub);

        // Descuento de la línea: evalúa las reglas aplicables y toma la que
        // más descuente (no se acumulan). El subtotal guardado queda neto.
        const mejor = elegirMejorDescuento(cantidadBase, subtotalBruto, descuentosAplicables);
        const descuentoMonto = mejor ? mejor.monto : 0;
        const subtotalNeto = Math.round((subtotalBruto - descuentoMonto) * 100) / 100;

        total += subtotalNeto;
        descuentoTotal += descuentoMonto;
        prepared.push({
          id_producto: ln.id_producto, id_bodega: ln.id_bodega, cantidad: cantidadBase,
          precio: ln.precio_unitario_venta, subtotal: subtotalNeto,
          descuento_porcentaje: mejor ? mejor.porcentaje : 0,
          descuento_monto: descuentoMonto,
          id_descuento: mejor ? mejor.descuento.id_descuento : null,
          descuento_nombre: mejor ? mejor.descuento.nombre : null,
          id_presentacion: ln.id_presentacion, cantidad_presentacion: cantidadPresentacion,
        });
      }

      const totalQ = await client.query(`SELECT ROUND($1::numeric, 2) AS t`, [total]);
      total = Number(totalQ.rows[0].t);
      descuentoTotal = Math.round(descuentoTotal * 100) / 100;

      // ── Crédito: fecha de factura, plan de cuotas y límite del cliente ──
      // Todo se valida ANTES de tocar el stock, para rechazar sin efectos.
      let fechaFactura: string | null = null;
      let cuotas: Cuota[] = [];
      if (esCredito) {
        const hoyRes = await client.query<{ hoy: string }>(`SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS hoy`);
        const hoy = hoyRes.rows[0].hoy;
        fechaFactura = fechaFacturaBody ?? hoy;
        const diff = diferenciaDias(hoy, fechaFactura);
        if (diff > MAX_DIAS_ADELANTE_FACTURA || diff < -MAX_DIAS_ATRAS_FACTURA) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: `La fecha de factura no puede ser futura ni de hace más de ${MAX_DIAS_ATRAS_FACTURA} días` },
            { status: 400 }
          );
        }
        if (total <= 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Una venta a crédito debe tener un total mayor a 0" }, { status: 400 });
        }

        const verificacion = await verificarLimiteAntesDeDeuda(client, Number(idCliente), total);
        if (!verificacion.permitido) {
          await client.query("ROLLBACK");
          log.warn(
            { id_cliente: idCliente, total, motivo: verificacion.motivo },
            "Venta a crédito rechazada por límite de crédito del cliente"
          );
          return NextResponse.json(
            { error: verificacion.motivo || "No se puede otorgar este crédito." },
            { status: 400 }
          );
        }

        cuotas = generarCuotas(fechaFactura, plazoDias, numeroCuotas, total);
        fechaLimite = cuotas[cuotas.length - 1].fecha_vencimiento;
      }

      const insVenta = await client.query(
        `INSERT INTO venta (id_cliente, id_empleado, estado_venta, tipo_venta, tipo_entrega,
          direccion_entrega, enlinea, total, fecha_limite_pago, condicion_pago, fecha_venta, descuento_total)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8, $9, COALESCE(($10::date + LOCALTIME)::timestamp, NOW()), $11)
         RETURNING id_venta`,
        [idCliente, usuario.id_usuario, estado_venta, tipoVentaFinal, tipo_entrega,
         tipo_entrega === "EN_TIENDA" ? null : direccion || null, total, fechaLimite,
         esCredito ? "CREDITO" : "CONTADO", fechaFactura, descuentoTotal]
      );

      const idVenta = insVenta.rows[0].id_venta as number;

      for (const p of prepared) {
        const stock = await client.query(
          `SELECT cantidad_disponible FROM bodega_producto WHERE id_bodega = $1 AND id_producto = $2 FOR UPDATE`,
          [p.id_bodega, p.id_producto]
        );
        const disponible = stock.rowCount && stock.rows[0] ? Number(stock.rows[0].cantidad_disponible) : 0;
        if (disponible < p.cantidad) {
          await client.query("ROLLBACK");
          log.warn(
            { id_venta: idVenta, id_producto: p.id_producto, id_bodega: p.id_bodega, solicitado: p.cantidad, disponible, usuario: usuario.id_usuario },
            "Venta rechazada por stock insuficiente"
          );
          return NextResponse.json(
            { error: `Stock insuficiente para el producto id ${p.id_producto} en la bodega id ${p.id_bodega} (disponible: ${disponible})` },
            { status: 400 }
          );
        }

        await client.query(
          `INSERT INTO detalle_venta (id_venta, id_producto, id_bodega, cantidad, precio_unitario, subtotal,
                                      descuento_porcentaje, descuento_monto, id_descuento, descuento_nombre)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [idVenta, p.id_producto, p.id_bodega, p.cantidad, p.precio, p.subtotal,
           p.descuento_porcentaje, p.descuento_monto, p.id_descuento, p.descuento_nombre]
        );
        await client.query(
          `UPDATE bodega_producto SET cantidad_disponible = cantidad_disponible - $1, ultima_actualizacion = NOW()
           WHERE id_bodega = $2 AND id_producto = $3`,
          [p.cantidad, p.id_bodega, p.id_producto]
        );
        await client.query(
          `INSERT INTO kardex (id_bodega, id_producto, tipo_movimiento, cantidad, descripcion) VALUES ($1,$2,'SALIDA',$3,$4)`,
          [p.id_bodega, p.id_producto, p.cantidad, `Venta #${idVenta}`]
        );
      }

      // ── Entrega a domicilio: la venta genera su pedido para bodega ──
      // La orden es solo el "ticket" que recorre el flujo de preparación
      // (CONFIRMADO -> EN_PREPARACION -> ENVIADO -> ENTREGADO). La venta ya
      // descontó el stock y, si es a crédito, genera la cuenta por cobrar.
      let idOrden: number | null = null;
      if (tipo_entrega === "DOMICILIO") {
        const orden = await client.query(
          `INSERT INTO orden (id_cliente, id_usuario, estado, notas, total, id_venta)
           VALUES ($1, $2, 'CONFIRMADO', $3, $4, $5) RETURNING id_orden`,
          [idCliente, usuario.id_usuario, `Entrega a domicilio: ${direccion}`, total, idVenta]
        );
        idOrden = orden.rows[0].id_orden as number;
        for (const p of prepared) {
          await client.query(
            `INSERT INTO detalle_orden
               (id_orden, id_producto, id_bodega, cantidad, precio_unitario, subtotal, id_presentacion, cantidad_presentacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [idOrden, p.id_producto, p.id_bodega, p.cantidad, p.precio, p.subtotal, p.id_presentacion, p.cantidad_presentacion]
          );
        }
      }

      // ── Crédito: factura + cuenta por cobrar + plan de cuotas ──
      let creditoCreado: {
        id_deuda: number;
        id_factura: number;
        numero_factura: string;
        tipo_documento: TipoDocumento;
        fecha_factura: string;
        fecha_limite_pago: string;
        plazo_dias: number;
        cuotas: Cuota[];
        alerta: Awaited<ReturnType<typeof recalcularBloqueoCliente>>;
      } | null = null;

      if (esCredito && fechaFactura) {
        const cli = datosCliente;

        // El número de factura lo da la secuencia de Postgres (correlativo, sin repetidos).
        const factura = await client.query(
          `INSERT INTO factura
             (id_venta, numero_factura, tipo_documento, nombre_cliente, nit_cliente,
              direccion_cliente, total_factura)
           VALUES ($1, $2 || '-' || LPAD(nextval('factura_numero_seq')::text, 6, '0'),
                   $3, $4, $5, $6, $7)
           RETURNING id_factura, numero_factura`,
          [
            idVenta,
            prefijoTipoDocumento(tipoDocumento),
            tipoDocumento,
            cli.nombre || "Consumidor Final",
            nitCliente,
            direccionCliente || null,
            total,
          ]
        );

        const deuda = await client.query(
          `INSERT INTO deuda (nombre_deudor, telefono_deudor, fecha_inicio, fecha_limite_pago, monto_total,
                              id_usuario, id_cliente, id_venta, plazo_dias, numero_cuotas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id_deuda`,
          [cli.nombre || "Cliente", cli.telefono || null, fechaFactura, fechaLimite, total,
           usuario.id_usuario, idCliente, idVenta, plazoDias, numeroCuotas]
        );
        const idDeuda = deuda.rows[0].id_deuda as number;

        // deuda_producto tiene una fila por producto: si el mismo producto salió
        // de dos bodegas, se suman sus cantidades y subtotales.
        const porProducto = new Map<number, { cantidad: number; subtotal: number }>();
        for (const p of prepared) {
          const acum = porProducto.get(p.id_producto) ?? { cantidad: 0, subtotal: 0 };
          acum.cantidad += p.cantidad;
          acum.subtotal = Math.round((acum.subtotal + p.subtotal) * 100) / 100;
          porProducto.set(p.id_producto, acum);
        }
        for (const [idProducto, acum] of porProducto) {
          await client.query(
            `INSERT INTO deuda_producto (id_deuda, id_producto, cantidad, precio_unitario, subtotal)
             VALUES ($1, $2, $3, $4, $5)`,
            [idDeuda, idProducto, acum.cantidad, Math.round((acum.subtotal / acum.cantidad) * 100) / 100, acum.subtotal]
          );
        }

        for (const c of cuotas) {
          await client.query(
            `INSERT INTO cuota_credito (id_deuda, numero, fecha_vencimiento, monto) VALUES ($1, $2, $3, $4)`,
            [idDeuda, c.numero, c.fecha_vencimiento, c.monto]
          );
        }

        // Al crecer el saldo por cobrar puede alcanzarse el límite del cliente.
        const alerta = await recalcularBloqueoCliente(client, Number(idCliente));

        creditoCreado = {
          id_deuda: idDeuda,
          id_factura: factura.rows[0].id_factura,
          numero_factura: factura.rows[0].numero_factura,
          tipo_documento: tipoDocumento,
          fecha_factura: fechaFactura,
          fecha_limite_pago: cuotas[cuotas.length - 1].fecha_vencimiento,
          plazo_dias: plazoDias,
          cuotas,
          alerta,
        };
      }

      await client.query("COMMIT");
      log.info(
        {
          id_venta: idVenta, id_cliente: idCliente, tipo_venta: tipoVentaFinal, forzado: forzarTipoVenta, total,
          descuento_total: descuentoTotal,
          condicion_pago: esCredito ? "CREDITO" : "CONTADO", tipo_documento: tipoDocumento,
          id_deuda: creditoCreado?.id_deuda, usuario: usuario.id_usuario,
        },
        "Venta registrada"
      );
      return NextResponse.json({
        mensaje: esCredito
          ? "Venta a crédito registrada: factura y cuenta por cobrar generadas"
          : "Venta registrada correctamente",
        id_venta: idVenta,
        total,
        descuento_total: descuentoTotal,
        tipo_venta: tipoVentaFinal,
        condicion_pago: esCredito ? "CREDITO" : "CONTADO",
        ...(idOrden ? { id_orden: idOrden } : {}),
        ...(creditoCreado ? { credito: creditoCreado } : {}),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      log.error({ err: error }, "Error al registrar la venta [POST]");
      return NextResponse.json({ error: "Error al registrar la venta" }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    log.error({ err: error }, "Error al procesar la solicitud de venta [POST parse]");
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}