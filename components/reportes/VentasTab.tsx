import { Icon } from "@/components/Icon";
import { BarChart, EmptyChart } from "./charts";
import { ESTADO_COLOR } from "./constants";
import { s } from "./styles";
import type { EstadisticasData } from "./types";
import { Card, CounterGrid, ProgressCard, SplitBar, StatCard } from "./ui";
import { agruparIngresos, cap, fmtDate, pct, q } from "./utils";

const TIPO_COLORS = ["rgba(45,106,79,.8)", "rgba(88,166,255,.8)"];

export function VentasTab({ data }: { data: EstadisticasData }) {
  const comp = data.comparativa_periodo_anterior ?? null;
  const deltaVentas = comp ? pct(data.resumen.total_ventas, comp.total_ventas_anterior) : null;
  const deltaIngresos = comp ? pct(data.resumen.ingresos_totales, comp.ingresos_anteriores) : null;
  const k = data.kpis;
  const { puntos, granularidad } = agruparIngresos(data.ventas_por_dia);
  const tituloIngresos = { dia: "Ingresos por día", semana: "Ingresos por semana", mes: "Ingresos por mes" }[granularidad];
  const diaPico = data.ventas_por_dia.length > 0 ? data.ventas_por_dia.reduce((a, b) => (b.total_dia > a.total_dia ? b : a)) : null;
  const horaPico = data.ventas_por_hora.length > 0 ? data.ventas_por_hora.reduce((a, b) => (b.cantidad > a.cantidad ? b : a)) : null;

  return (
    <div style={s.tabStack}>

      {/* Arriba: los números que importan, en palabras de tienda */}
      <div style={s.statsGrid}>
        <StatCard icon="bill" label="Ventas totales" value={data.resumen.total_ventas.toLocaleString("es-GT")} sub={comp ? `antes: ${comp.total_ventas_anterior}` : undefined} delta={deltaVentas} />
        <StatCard icon="money-bag" label="Ingresos totales" value={q(data.resumen.ingresos_totales)} sub={comp ? `antes: ${q(comp.ingresos_anteriores)}` : undefined} delta={deltaIngresos} />
        <StatCard icon="ticket" label="Venta promedio" value={q(data.resumen.ticket_promedio)} sub="lo que se vende en cada venta" />
        <StatCard icon="close" label="Canceladas" value={data.resumen.ventas_canceladas.toLocaleString("es-GT")} sub="no cuentan en los ingresos" />
        <ProgressCard icon="money-bag" label="Ventas fiadas" value={`${k.ventas.pct_ventas_credito}%`} pct={k.ventas.pct_ventas_credito} sub={`${k.ventas.ventas_credito} venta${k.ventas.ventas_credito !== 1 ? "s" : ""} · ${q(k.ventas.monto_credito)} sin cobrar de inmediato`} />
        <StatCard icon="shopping-cart" label="Ventas por terminar" value={k.operacion.ventas_pendientes.toLocaleString("es-GT")} sub={`${q(k.operacion.monto_ventas_pendientes)} sin cobrar o entregar`} />
      </div>

      {/* Abajo: gráficas */}
      {/* Fila 2 — Gráfica de barras + Producto #1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem" }}>
        <Card title={`${tituloIngresos} (Q)`}>
          {puntos.length === 1 ? (
            <EmptyChart label="Solo hay ventas de un día; con más días aparece la gráfica" />
          ) : (
            <BarChart puntos={puntos} />
          )}
          {diaPico && (
            <p style={{ marginTop: "0.6rem", fontSize: "0.82rem", color: "var(--muted)" }}>
              Día con más ventas: <strong style={{ color: "var(--accent2)" }}>{fmtDate(diaPico.fecha.slice(0, 10))}</strong>{" · "}{q(diaPico.total_dia)} en {diaPico.cantidad} venta{diaPico.cantidad !== 1 ? "s" : ""}
            </p>
          )}
        </Card>

        {data.producto_mas_comprado ? (
          <div style={s.heroCard}>
            <div style={s.heroBadge}>
              <Icon name="increase" variant="dark" size={12} />
              <span>Producto #1</span>
            </div>
            <div style={s.heroName}>{data.producto_mas_comprado.nombre_producto}</div>
            <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,.55)", marginBottom: "1rem" }}>
              <code style={s.heroCode}>{data.producto_mas_comprado.codigo_producto}</code>
              {" · "}{data.producto_mas_comprado.nombre_categoria}{" · "}{data.producto_mas_comprado.nombre_marca}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              {[
                { val: `${data.producto_mas_comprado.total_unidades.toLocaleString("es-GT", { maximumFractionDigits: 2 })}`, sub: data.producto_mas_comprado.unidad_medida + " vendidas" },
                { val: q(data.producto_mas_comprado.total_ingresos), sub: "en ingresos" },
                { val: String(data.producto_mas_comprado.veces_vendido), sub: "pedidos" },
              ].map(({ val, sub }) => (
                <div key={sub} style={s.heroStat}>
                  <span style={s.heroStatVal}>{val}</span>
                  <span style={s.heroStatSub}>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Card title="Producto más vendido"><EmptyChart label="Sin ventas en el periodo" /></Card>
        )}
      </div>

      <Card title="Cómo se vendió">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
          <div>
            <div style={s.kpiGroupLabel}>Tipo de venta</div>
            <SplitBar segments={data.ventas_por_tipo.map((t, i) => ({ label: cap(t.tipo_venta), value: t.cantidad, color: TIPO_COLORS[i % TIPO_COLORS.length], detail: `${t.cantidad} · ${q(t.ingresos)}` }))} />
          </div>
          <div>
            <div style={s.kpiGroupLabel}>Estado de las ventas</div>
            <CounterGrid items={data.ventas_por_estado.map((e) => ({ label: cap(e.estado_venta), value: e.cantidad, color: ESTADO_COLOR[e.estado_venta] ?? "var(--muted)" }))} />
          </div>
          <div>
            <div style={s.kpiGroupLabel}>Hora más movida</div>
            {horaPico ? (
              <>
                <div style={{ fontFamily: "var(--font-head)", fontSize: "1.6rem", fontWeight: 700, color: "var(--text)" }}>{horaPico.hora}:00 h</div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.15rem" }}>{horaPico.cantidad} venta{horaPico.cantidad !== 1 ? "s" : ""} a esa hora</div>
              </>
            ) : (
              <EmptyChart label="Sin ventas en el periodo" />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
