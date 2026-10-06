import { Icon } from "@/components/Icon";
import { EmptyChart, HBarChart } from "./charts";
import { s } from "./styles";
import type { EstadisticasData } from "./types";
import { Card, StatCard } from "./ui";
import { q } from "./utils";

export function InventarioTab({ data }: { data: EstadisticasData }) {
  const inv = data.kpis.inventario;

  return (
    <div style={s.tabStack}>

      {/* Arriba: lo que hay que atender */}
      <div style={s.statsGrid}>
        <StatCard icon="inventory" label="Por reponer" value={inv.productos_bajo_minimo.toLocaleString("es-GT")} sub="productos por debajo de su mínimo" />
        <StatCard icon="box" label="Sin venderse" value={inv.productos_sin_movimiento.toLocaleString("es-GT")} sub="sin salidas de bodega en el periodo" />
      </div>

      {/* Abajo: detalle */}
      <div style={s.twoCol}>
        <Card title="Por reponer (bajo su mínimo)">
          {inv.detalle_bajo_minimo.length === 0 ? <EmptyChart label="Todo está arriba de su mínimo" /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Producto</th><th style={{ ...s.th, textAlign: "right" }}>Disponible</th><th style={{ ...s.th, textAlign: "right" }}>Mínimo</th></tr></thead>
              <tbody>
                {data.kpis.inventario.detalle_bajo_minimo.map((d) => (
                  <tr key={`${d.id_producto}-${d.nombre_bodega}`} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>{d.nombre_producto}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{d.nombre_bodega}</div>
                    </td>
                    <td style={{ ...s.td, textAlign: "right", color: "var(--red)", fontWeight: 600 }}>{d.cantidad_disponible}</td>
                    <td style={{ ...s.td, textAlign: "right", color: "var(--muted)" }}>{d.stock_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>
        <Card title="Dinero parado en bodega">
          {inv.detalle_sin_movimiento.length === 0 ? <EmptyChart label="No hay productos parados" /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Producto</th><th style={{ ...s.th, textAlign: "right" }}>Stock</th><th style={{ ...s.th, textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {data.kpis.inventario.detalle_sin_movimiento.map((d) => (
                  <tr key={`${d.id_producto}-${d.nombre_bodega}`} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>{d.nombre_producto}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{d.nombre_bodega}</div>
                    </td>
                    <td style={{ ...s.td, textAlign: "right", color: "var(--muted)" }}>{d.cantidad_disponible}</td>
                    <td style={{ ...s.td, textAlign: "right", fontWeight: 600 }}>{q(d.valor_inmovilizado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </div>

      <div style={s.twoCol}>
        <Card title="Top 10 productos más vendidos (unidades)">
          {data.top_productos.length === 0 ? <EmptyChart label="Sin ventas en el periodo" /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Producto</th>
                    <th style={{ ...s.th, textAlign: "right" }}>Unidades</th>
                    <th style={{ ...s.th, textAlign: "right" }}>Ingresos</th>
                    <th style={{ ...s.th, textAlign: "right" }}>Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_productos.map((p, i) => (
                    <tr key={p.id_producto} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...s.td, color: i === 0 ? "var(--accent)" : "var(--muted)", fontWeight: i === 0 ? 700 : 400, width: 28 }}>
                        {i === 0 ? <Icon name="increase" variant="dark" size={16} /> : i + 1}
                      </td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>{p.nombre_producto}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          <code style={{ color: "var(--accent)", fontSize: "0.7rem", background: "var(--surface2)", padding: "0.05rem 0.3rem", borderRadius: 4, border: "1px solid var(--border)" }}>{p.codigo_producto}</code>
                          {" · "}{p.nombre_categoria}
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.total_unidades.toLocaleString("es-GT", { maximumFractionDigits: 2 })} <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{p.unidad_medida}</span></td>
                      <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{q(p.total_ingresos)}</td>
                      <td style={{ ...s.td, textAlign: "right" }}>{p.veces_vendido}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Ingresos por categoría">
          {data.ingresos_por_categoria.length === 0 ? <EmptyChart label="Sin datos" /> : (
            <HBarChart data={data.ingresos_por_categoria as unknown as Record<string, number | string>[]} labelKey="nombre_categoria" valueKey="total_ingresos" formatValue={q} color="rgba(232,160,69,.75)" />
          )}
        </Card>
      </div>

      <Card title="Bodegas con mayor movimiento">
        {data.top_bodegas.length === 0 ? <EmptyChart label="Sin movimientos en el periodo" /> : (
          <HBarChart data={data.top_bodegas as unknown as Record<string, number | string>[]} labelKey="nombre_bodega" valueKey="total_unidades" formatValue={(v) => `${v.toLocaleString("es-GT", { maximumFractionDigits: 2 })} u.`} color="rgba(88,166,255,.75)" />
        )}
      </Card>
    </div>
  );
}
