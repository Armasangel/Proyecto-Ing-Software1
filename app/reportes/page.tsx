"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";
import { Icon } from "@/components/Icon";
import { BarChart, DonutChart, EmptyChart, HBarChart, HourChart } from "@/components/reportes/charts";
import { CAT_COLORS, ESTADO_COLOR, PERIODOS } from "@/components/reportes/constants";
import { s } from "@/components/reportes/styles";
import type { EstadisticasData, PeriodoKey } from "@/components/reportes/types";
import { Card, DeltaBadge, LegendPill, StatCard, StatDescRow } from "@/components/reportes/ui";
import { fmtDate, pct, q } from "@/components/reportes/utils";

export default function EstadisticasPage() {
  const usuario = useDuenoSession();

  const [periodo, setPeriodo] = useState<PeriodoKey>("month");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState<EstadisticasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState<"periodo" | "todo" | null>(null);

  const fetchData = useCallback(async (p: PeriodoKey, d: string, h: string) => {
    setLoading(true); setError("");
    try {
      const sp = new URLSearchParams({ periodo: p });
      if (p === "custom") { sp.set("desde", d); sp.set("hasta", h); }
      const res = await fetch(`/api/estadisticas?${sp}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar estadísticas");
      setData(json as EstadisticasData);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!usuario) return; fetchData("month", "", ""); }, [usuario, fetchData]);

  const handleAplicar = () => {
    if (periodo === "custom" && (!desde || !hasta)) { setError("Selecciona fechas de inicio y fin."); return; }
    fetchData(periodo, desde, hasta);
  };

  async function handleExportar(tipo: "periodo" | "todo") {
    setExportando(tipo);
    setError("");
    try {
      const sp = new URLSearchParams({ periodo: tipo === "todo" ? "year" : periodo });
      if (tipo === "periodo" && periodo === "custom") {
        if (!desde || !hasta) { setError("Selecciona fechas de inicio y fin."); setExportando(null); return; }
        sp.set("desde", desde); sp.set("hasta", hasta);
      }
      const res = await fetch(`/api/estadisticas?${sp}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al exportar");
      const exportData = json as EstadisticasData;

      const rows: (string | number)[][] = [];
      const addSection = (titulo: string) => { rows.push([]); rows.push([titulo]); };

      rows.push(["Reporte de estadísticas", tipo === "todo" ? "Todo el histórico" : `Periodo: ${exportData.periodo.tipo}`]);

      addSection("Resumen");
      rows.push(["Ventas totales", exportData.resumen.total_ventas]);
      rows.push(["Ingresos totales", exportData.resumen.ingresos_totales]);
      rows.push(["Ticket promedio", exportData.resumen.ticket_promedio]);
      rows.push(["Ventas canceladas", exportData.resumen.ventas_canceladas]);

      addSection("Resumen de ventas");
      rows.push(["Ticket promedio", exportData.estadisticas_descriptivas.media]);
      rows.push(["Ticket típico", exportData.estadisticas_descriptivas.mediana]);
      rows.push(["Monto más común", exportData.estadisticas_descriptivas.moda.join(" / ")]);
      rows.push(["Qué tanto varían tus ventas", exportData.estadisticas_descriptivas.desviacion_estandar]);
      rows.push(["Ticket mínimo", exportData.estadisticas_descriptivas.min_total]);
      rows.push(["Ticket máximo", exportData.estadisticas_descriptivas.max_total]);

      addSection("Ventas por día");
      rows.push(["Fecha", "Total", "Cantidad"]);
      exportData.ventas_por_dia.forEach((d) => rows.push([d.fecha, d.total_dia, d.cantidad]));

      addSection("Top productos");
      rows.push(["Producto", "Código", "Categoría", "Marca", "Unidades", "Ingresos", "Veces vendido"]);
      exportData.top_productos.forEach((p) => rows.push([p.nombre_producto, p.codigo_producto, p.nombre_categoria, p.nombre_marca, p.total_unidades, p.total_ingresos, p.veces_vendido]));

      addSection("Top clientes");
      rows.push(["Nombre", "Correo", "Total compras", "Cantidad pedidos"]);
      exportData.top_clientes.forEach((c) => rows.push([c.nombre, c.correo, c.total_compras, c.cantidad_pedidos]));

      addSection("Ingresos por categoría");
      rows.push(["Categoría", "Ingresos", "Unidades"]);
      exportData.ingresos_por_categoria.forEach((c) => rows.push([c.nombre_categoria, c.total_ingresos, c.total_unidades]));

      addSection("KPIs de negocio");
      rows.push(["% ventas al crédito", `${exportData.kpis.ventas.pct_ventas_credito}%`]);
      rows.push(["Monto vendido al crédito", exportData.kpis.ventas.monto_credito]);
      rows.push(["Productos bajo su mínimo", exportData.kpis.inventario.productos_bajo_minimo]);
      rows.push(["Rotación de inventario", exportData.kpis.inventario.rotacion_inventario]);
      rows.push(["Productos sin movimiento", exportData.kpis.inventario.productos_sin_movimiento]);
      rows.push(["% cartera vencida", `${exportData.kpis.deuda.pct_cartera_vencida}%`]);
      rows.push(["Tasa de recuperación de deuda", `${exportData.kpis.deuda.tasa_recuperacion}%`]);
      rows.push(["Ventas sin cerrar (sin cobrar/entregar)", exportData.kpis.operacion.ventas_pendientes]);
      rows.push(["Monto de ventas sin cerrar", exportData.kpis.operacion.monto_ventas_pendientes]);
      rows.push(["Pedidos pendientes", exportData.kpis.operacion.pedidos_pendientes]);
      rows.push(["% cancelación de ventas", `${exportData.kpis.operacion.pct_cancelacion}%`]);
      rows.push([]);

      addSection("Deudas y deudores (estado actual)");
      rows.push(["Deuda pendiente total", exportData.deudas.resumen.deuda_pendiente_total]);
      rows.push(["Deudores activos", exportData.deudas.resumen.cantidad_deudores]);
      rows.push(["Deudas pendientes", exportData.deudas.resumen.cantidad_deudas_pendientes]);
      rows.push(["Clientes bloqueados por deuda", exportData.deudas.resumen.clientes_bloqueados]);
      rows.push(["Deuda promedio por deudor", exportData.deudas.resumen.deuda_promedio_por_deudor]);
      rows.push([]);
      rows.push(["Top deudores", "Teléfono", "Deuda pendiente", "Límite", "Estado"]);
      exportData.deudas.top_deudores.forEach((d) =>
        rows.push([
          d.nombre,
          d.telefono ?? "",
          d.deuda_pendiente,
          d.limite_deuda ?? "",
          d.id_cliente === null ? "Sin vincular" : d.puede_comprar ? "Activo" : "Bloqueado",
        ])
      );

      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Reporte");
      worksheet.addRows(rows.filter((r) => r.length > 0));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fechaHoy = new Date().toISOString().slice(0, 10);
      a.download = `reporte-${tipo === "todo" ? "completo" : periodo}-${fechaHoy}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setExportando(null);
    }
  }

  if (!usuario) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;

  const comp = data?.comparativa_periodo_anterior ?? null;
  const deltaVentas   = comp ? pct(data!.resumen.total_ventas, comp.total_ventas_anterior) : null;
  const deltaIngresos = comp ? pct(data!.resumen.ingresos_totales, comp.ingresos_anteriores) : null;

  const tipoSegments = (data?.ventas_por_tipo ?? []).map((t, i) => ({ label: t.tipo_venta, value: t.cantidad, color: i === 0 ? "rgba(45,106,79,.8)" : "rgba(88,166,255,.8)" }));
  const estadoSegments = (data?.ventas_por_estado ?? []).map((e) => ({ label: e.estado_venta, value: e.cantidad, color: ESTADO_COLOR[e.estado_venta] ?? "var(--muted)" }));
  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label ?? "";
  const subtitle = loading ? "Cargando estadísticas…" : data ? `Periodo: ${periodoLabel}${periodo === "custom" ? ` · ${desde} → ${hasta}` : ""} · ${data.resumen.total_ventas} ventas` : "Resumen estadístico de ventas";

  return (
    <StaffShell usuario={usuario} title="Estadísticas" subtitle={subtitle}>

      {/* ── Selector de periodo ── */}
      <div style={s.filterBar}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {PERIODOS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriodo(p.value)} style={{ ...s.chip, background: periodo === p.value ? "rgba(45,106,79,.18)" : "transparent", borderColor: periodo === p.value ? "rgba(45,106,79,.55)" : "var(--border)", color: periodo === p.value ? "var(--text)" : "var(--muted)" }}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={s.miniLabel}>Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={s.dateInput} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={s.miniLabel}>Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={s.dateInput} />
            </div>
          </div>
        )}
        <button type="button" onClick={handleAplicar} disabled={loading} style={s.btnPrimary}>
          {loading ? "Cargando…" : "Aplicar"}
        </button>
        <button type="button" onClick={() => handleExportar("periodo")} disabled={!data || exportando !== null} style={s.btnSecondary}>          {exportando === "periodo" ? "Exportando…" : "Exportar periodo actual"}
        </button>
        <button type="button" onClick={() => handleExportar("todo")} disabled={exportando !== null} style={s.btnSecondary}>
          {exportando === "todo" ? "Exportando…" : "Exportar todo"}
        </button>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── Estado vacío ── */}
      {!data && !loading && !error && (
        <div style={s.emptyState}>
          <div style={s.emptyIconWrap}>
            <Icon name="report" variant="dark" size={40} />
          </div>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            Selecciona un periodo y presiona Aplicar.
          </p>
        </div>
      )}

      {/* ── Skeleton ── */}
      {loading && !data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ ...s.statsGrid }}>
            {[1, 2, 3, 4].map((i) => (<div key={i} style={{ ...s.statCard, ...s.skeleton, height: 100 }} />))}
          </div>
          <div style={{ ...s.card, ...s.skeleton, height: 220 }} />
        </div>
      )}

      {/* ── Contenido ── */}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Fila 0 — KPIs de negocio: números pensados para actuar, no solo describir */}
          <Card title="KPIs de negocio">
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

              <div>
                <div style={s.kpiGroupLabel}>Ventas</div>
                <div style={s.statsGrid}>
                  <StatCard icon="money-bag" label="Ventas al crédito" value={`${data.kpis.ventas.pct_ventas_credito}%`} sub={`${data.kpis.ventas.ventas_credito} venta${data.kpis.ventas.ventas_credito !== 1 ? "s" : ""} · ${q(data.kpis.ventas.monto_credito)} sin cobrar de inmediato`} />
                </div>
              </div>

              <div>
                <div style={s.kpiGroupLabel}>Inventario</div>
                <div style={s.statsGrid}>
                  <StatCard icon="inventory" label="Bajo su mínimo"      value={data.kpis.inventario.productos_bajo_minimo.toLocaleString("es-GT")} sub="productos que ya tocan reordenar" />
                  <StatCard icon="transfer"  label="Rotación de inventario" value={data.kpis.inventario.rotacion_inventario.toLocaleString("es-GT")} sub="unidades vendidas / stock actual" />
                  <StatCard icon="box"       label="Sin movimiento"     value={data.kpis.inventario.productos_sin_movimiento.toLocaleString("es-GT")} sub="sin salidas de bodega en el periodo" />
                </div>
              </div>

              <div>
                <div style={s.kpiGroupLabel}>Clientes y deuda</div>
                <div style={s.statsGrid}>
                  <StatCard icon="lockout" label="Cartera vencida"          value={`${data.kpis.deuda.pct_cartera_vencida}%`} sub={`${q(data.kpis.deuda.deuda_pendiente_bloqueados)} en clientes ya bloqueados`} />
                  <StatCard icon="debt"    label="Tasa de recuperación"     value={`${data.kpis.deuda.tasa_recuperacion}%`}   sub="deuda pagada / deuda generada (histórico)" />
                </div>
              </div>

              <div>
                <div style={s.kpiGroupLabel}>Operación</div>
                <div style={s.statsGrid}>
                  <StatCard icon="shopping-cart" label="Ventas sin cerrar" value={data.kpis.operacion.ventas_pendientes.toLocaleString("es-GT")} sub={`${q(data.kpis.operacion.monto_ventas_pendientes)} sin cobrar/entregar`} />
                  <StatCard icon="hand-truck"    label="Pedidos pendientes" value={data.kpis.operacion.pedidos_pendientes.toLocaleString("es-GT")} sub={`${q(data.kpis.operacion.monto_pedidos_pendientes)} en pedidos abiertos`} />
                  <StatCard icon="close"         label="% cancelación"     value={`${data.kpis.operacion.pct_cancelacion}%`} sub="de las ventas del periodo" />
                </div>
              </div>

              {(data.kpis.inventario.detalle_bajo_minimo.length > 0 || data.kpis.inventario.detalle_sin_movimiento.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                  {data.kpis.inventario.detalle_bajo_minimo.length > 0 && (
                    <div>
                      <div style={s.kpiGroupLabel}>Productos bajo su mínimo</div>
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
                    </div>
                  )}

                  {data.kpis.inventario.detalle_sin_movimiento.length > 0 && (
                    <div>
                      <div style={s.kpiGroupLabel}>Mayor capital inmovilizado</div>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Fila 1 — Tarjetas de resumen */}
          <div style={s.statsGrid}>
            <StatCard icon="bill"     label="Ventas totales"   value={data.resumen.total_ventas.toLocaleString("es-GT")} sub={comp ? `vs ${comp.total_ventas_anterior} periodo ant.` : undefined} delta={deltaVentas} />
            <StatCard icon="money-bag" label="Ingresos totales" value={q(data.resumen.ingresos_totales)} sub={comp ? `vs ${q(comp.ingresos_anteriores)} periodo ant.` : undefined} delta={deltaIngresos} />
            <StatCard icon="ticket"   label="Ticket promedio"  value={q(data.resumen.ticket_promedio)} sub="por venta (media)" />
            <StatCard icon="close"    label="Canceladas"       value={data.resumen.ventas_canceladas.toLocaleString("es-GT")} sub="excluidas de ingresos" />
          </div>

          {/* Fila 2 — Gráfica de barras + Producto #1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem" }}>
            <Card title="Ingresos diarios (Q)">
              <BarChart data={data.ventas_por_dia} />
              {data.ventas_por_dia.length > 0 && (() => {
                const peak = data.ventas_por_dia.reduce((a, b) => b.total_dia > a.total_dia ? b : a);
                return <p style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>Día pico: <strong style={{ color: "var(--accent)" }}>{peak.fecha}</strong>{" · "}{q(peak.total_dia)} en {peak.cantidad} venta{peak.cantidad !== 1 ? "s" : ""}</p>;
              })()}
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

          {/* Fila 3 — Estadísticas descriptivas */}
          <Card title="Resumen de tus ventas (Q)">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 2.5rem" }}>
              <div>
                <StatDescRow label="Ticket promedio" value={q(data.estadisticas_descriptivas.media)} hint="Cuánto se vende en promedio por venta" />
                <StatDescRow label="Ticket típico" value={q(data.estadisticas_descriptivas.mediana)} hint="La mitad de tus ventas fue menor a este monto, la otra mitad mayor" />
                <StatDescRow label="Monto más común" value={data.estadisticas_descriptivas.moda.length > 0 ? data.estadisticas_descriptivas.moda.map(q).join(", ") : "Sin un monto repetido"} hint="El valor que más se repitió en tus ventas" />
              </div>
              <div>
                <StatDescRow label="Qué tanto varían tus ventas" value={q(data.estadisticas_descriptivas.desviacion_estandar)} hint="Entre más alto, más distintos son los montos entre sí" />
                <StatDescRow label="Ticket mínimo" value={q(data.estadisticas_descriptivas.min_total)} />
                <StatDescRow label="Ticket máximo" value={q(data.estadisticas_descriptivas.max_total)} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem 0" }}>
                <div style={s.nBox}>
                  <span style={s.nVal}>{data.estadisticas_descriptivas.n}</span>
                  <span style={s.nLabel}>ventas analizadas</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Fila 4 — Donas + Bodegas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
            <Card title="Por tipo de venta">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <div style={{ width: 110, flexShrink: 0 }}><DonutChart segments={tipoSegments} size={110} /></div>
                <div style={{ flex: 1 }}>
                  {data.ventas_por_tipo.map((t, i) => <LegendPill key={t.tipo_venta} color={tipoSegments[i]?.color} label={t.tipo_venta} value={`${t.cantidad} · ${q(t.ingresos)}`} />)}
                  {data.ventas_por_tipo.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Sin datos</p>}
                </div>
              </div>
            </Card>
            <Card title="Por estado">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <div style={{ width: 110, flexShrink: 0 }}><DonutChart segments={estadoSegments} size={110} /></div>
                <div style={{ flex: 1 }}>
                  {data.ventas_por_estado.map((e) => <LegendPill key={e.estado_venta} color={ESTADO_COLOR[e.estado_venta]} label={e.estado_venta} value={e.cantidad} />)}
                  {data.ventas_por_estado.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Sin datos</p>}
                </div>
              </div>
            </Card>
            <Card title="Bodegas con mayor movimiento">
              {data.top_bodegas.length === 0 ? <EmptyChart label="Sin movimientos en el periodo" /> : (
                <HBarChart data={data.top_bodegas as unknown as Record<string, number | string>[]} labelKey="nombre_bodega" valueKey="total_unidades" formatValue={(v) => `${v.toLocaleString("es-GT", { maximumFractionDigits: 2 })} u.`} color="rgba(88,166,255,.75)" />
              )}
            </Card>
          </div>

          {/* Fila 5 — Top productos + Categorías */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <DonutChart segments={data.ingresos_por_categoria.map((c, i) => ({ label: c.nombre_categoria, value: c.total_ingresos, color: CAT_COLORS[i % CAT_COLORS.length] }))} size={100} />
                    </div>
                    <div style={{ flex: 1 }}>
                      {data.ingresos_por_categoria.map((c, i) => <LegendPill key={c.nombre_categoria} color={CAT_COLORS[i % CAT_COLORS.length]} label={c.nombre_categoria} value={q(c.total_ingresos)} />)}
                    </div>
                  </div>
                  <HBarChart data={data.ingresos_por_categoria as unknown as Record<string, number | string>[]} labelKey="nombre_categoria" valueKey="total_ingresos" formatValue={q} color="rgba(232,160,69,.75)" />
                </div>
              )}
            </Card>
          </div>

          {/* Fila 6 — Hora del día + Top clientes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Actividad por hora del día">
              <HourChart data={data.ventas_por_hora} />
              {data.ventas_por_hora.length > 0 && (() => {
                const peak = data.ventas_por_hora.reduce((a, b) => b.cantidad > a.cantidad ? b : a);
                return <p style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>Hora pico: <strong style={{ color: "var(--accent)" }}>{peak.hora}:00 h</strong>{" · "}{peak.cantidad} venta{peak.cantidad !== 1 ? "s" : ""}</p>;
              })()}
            </Card>
            <Card title="Top 5 clientes por ingresos">
              {data.top_clientes.length === 0 ? <EmptyChart label="Sin datos en el periodo" /> : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.top_clientes.map((c, i) => (
                    <div key={c.id_cliente} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: i === 0 ? "rgba(45,106,79,.25)" : "var(--surface2)", border: `1px solid ${i === 0 ? "rgba(45,106,79,.45)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--muted)" }}>
                        {i === 0 ? <Icon name="increase" variant="dark" size={14} /> : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.correo}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{q(c.total_compras)}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{c.cantidad_pedidos} pedido{c.cantidad_pedidos !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Fila 7 — Deudas y deudores (estado actual, no filtrado por periodo) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={s.statsGrid}>
              <StatCard icon="money-bag" label="Deuda pendiente"       value={q(data.deudas.resumen.deuda_pendiente_total)} sub={`${data.deudas.resumen.cantidad_deudas_pendientes} deuda${data.deudas.resumen.cantidad_deudas_pendientes !== 1 ? "s" : ""} sin pagar`} />
              <StatCard icon="ticket"   label="Deudores activos"       value={data.deudas.resumen.cantidad_deudores.toLocaleString("es-GT")} sub="con deuda pendiente" />
              <StatCard icon="close"    label="Clientes bloqueados"    value={data.deudas.resumen.clientes_bloqueados.toLocaleString("es-GT")} sub="alcanzaron su límite de deuda" />
              <StatCard icon="bill"     label="Deuda promedio"         value={q(data.deudas.resumen.deuda_promedio_por_deudor)} sub="por deudor" />
            </div>

            <Card title="Top deudores (deuda pendiente actual)">
              {data.deudas.top_deudores.length === 0 ? <EmptyChart label="No hay deudas pendientes" /> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Persona</th>
                        <th style={s.th}>Estado</th>
                        <th style={{ ...s.th, textAlign: "right" }}>Deuda pendiente</th>
                        <th style={{ ...s.th, textAlign: "right" }}>Deudas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deudas.top_deudores.map((d, i) => (
                        <tr key={d.id_cliente ?? d.nombre} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ ...s.td, color: i === 0 ? "var(--accent)" : "var(--muted)", fontWeight: i === 0 ? 700 : 400, width: 28 }}>
                            {i === 0 ? <Icon name="increase" variant="dark" size={16} /> : i + 1}
                          </td>
                          <td style={s.td}>
                            <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>{d.nombre}</div>
                            {d.telefono && <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{d.telefono}</div>}
                          </td>
                          <td style={s.td}>
                            {d.id_cliente === null ? (
                              <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Sin vincular</span>
                            ) : (
                              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: d.puede_comprar ? "var(--green)" : "var(--red)" }}>
                                {d.puede_comprar ? "Activo" : "Bloqueado"}
                              </span>
                            )}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {q(d.deuda_pendiente)}
                            {d.limite_deuda !== null && (
                              <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>límite {q(d.limite_deuda)}</div>
                            )}
                          </td>
                          <td style={{ ...s.td, textAlign: "right" }}>{d.cantidad_deudas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

        </div>
      )}
    </StaffShell>
  );
}
