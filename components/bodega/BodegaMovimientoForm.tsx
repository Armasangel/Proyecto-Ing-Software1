"use client";

import { ProductoAutocompletar } from "@/components/ProductoAutocompletar";
import { MOTIVO_LABEL } from "@/lib/constants/bodega";
import { s } from "@/lib/styles/bodega";
import type { useBodega } from "@/hooks/useBodega";

export function BodegaMovimientoForm({ h }: { h: ReturnType<typeof useBodega> }) {
  const unidadBase = h.productos.find((p) => p.id_producto === Number(h.idProducto))?.unidad_medida;

  return (
    <div style={s.card}>
      <div style={s.field}>
        <label style={s.label}>Producto</label>
        <ProductoAutocompletar
          productos={h.productos}
          sugeridos={h.productosSugeridos}
          value={h.idProducto}
          onChange={h.setIdProducto}
          style={s.input}
          mensajeVacio={
            h.tab === "entrada"
              ? "Escribe para buscar un producto"
              : "No hay productos con existencias en tu bodega"
          }
        />
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Cantidad</label>
          <input
            style={s.input}
            type="number"
            min="0"
            step="1"
            value={h.cantidad}
            onChange={(e) => h.setCantidad(e.target.value)}
            placeholder="0"
            aria-label="Cantidad"
          />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Presentación</label>
          <select
            style={s.input}
            value={h.idPresentacion}
            onChange={(e) => h.setIdPresentacion(e.target.value)}
            aria-label="Presentación"
          >
            <option value="">{unidadBase || "Unidad base"}</option>
            {h.presentaciones.map((pr) => (
              <option key={pr.id_presentacion} value={pr.id_presentacion}>
                {pr.nombre_presentacion}
              </option>
            ))}
          </select>
        </div>
      </div>

      {h.tab === "salida" && (
        <div style={{ ...s.field, color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
          Motivo: <strong style={{ color: "var(--text)" }}>{MOTIVO_LABEL.MERMA}</strong>. Para pasar producto a la
          tienda usa la pestaña Traslado.
        </div>
      )}

      {h.tab === "traslado" && (
        <>
          <div style={s.field}>
            <label style={s.label}>Bodega origen</label>
            <input style={{ ...s.input, opacity: 0.75 }} value={h.nombreBodegaPropia || "Tu bodega"} disabled readOnly />
          </div>
          <div style={s.field}>
            <label style={s.label}>Bodega destino</label>
            <select
              style={s.input}
              value={h.idBodegaDestino}
              onChange={(e) => h.setIdBodegaDestino(e.target.value)}
              aria-label="Bodega destino"
            >
              <option value="">Selecciona la bodega destino…</option>
              {h.bodegasDestino.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.nombre_bodega}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div style={s.field}>
        <label style={s.label}>Descripción (opcional)</label>
        <input
          style={s.input}
          value={h.descripcion}
          onChange={(e) => h.setDescripcion(e.target.value)}
          placeholder="Detalle breve del movimiento"
        />
      </div>

      {h.mensaje && (
        <div
          style={{
            ...s.msgBox,
            borderColor: h.mensaje.tipo === "ok" ? "var(--accent2)" : "var(--red)",
            color: h.mensaje.tipo === "ok" ? "var(--accent2)" : "var(--red)",
          }}
        >
          {h.mensaje.texto}
        </div>
      )}

      <button type="button" style={s.submitBtn} onClick={h.enviar} disabled={h.enviando}>
        {h.enviando ? "Guardando…" : "Registrar movimiento"}
      </button>
    </div>
  );
}
