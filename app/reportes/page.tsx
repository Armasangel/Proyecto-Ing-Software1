"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";
import { Icon } from "@/components/Icon";
import { ClientesDeudasTab } from "@/components/reportes/ClientesDeudasTab";
import { InventarioTab } from "@/components/reportes/InventarioTab";
import { VentasTab } from "@/components/reportes/VentasTab";
import { PERIODOS } from "@/components/reportes/constants";
import { s } from "@/components/reportes/styles";
import { Tabs, panelId, tabId } from "@/components/reportes/Tabs";
import type { EstadisticasData, PeriodoKey } from "@/components/reportes/types";

type TabKey = "ventas" | "inventario" | "clientes";
const TABS: { key: TabKey; label: string }[] = [
  { key: "ventas", label: "Ventas" },
  { key: "inventario", label: "Inventario" },
  { key: "clientes", label: "Clientes y deudas" },
];

export default function EstadisticasPage() {
  const usuario = useDuenoSession();

  const [periodo, setPeriodo] = useState<PeriodoKey>("month");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState<EstadisticasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState<"periodo" | "todo" | null>(null);
  const [tab, setTab] = useState<TabKey>("ventas");

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

  /** Los periodos fijos se aplican al tocarlos; "Personalizado" espera las fechas y el botón Aplicar. */
  const handleSelectPeriodo = (p: PeriodoKey) => {
    setPeriodo(p);
    setError("");
    if (p !== "custom") fetchData(p, "", "");
  };

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

  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label ?? "";
  const subtitle = loading ? "Cargando estadísticas…" : data ? `Periodo: ${periodoLabel}${periodo === "custom" ? ` · ${desde} → ${hasta}` : ""} · ${data.resumen.total_ventas} ventas` : "Resumen estadístico de ventas";

  return (
    <StaffShell usuario={usuario} title="Estadísticas" subtitle={subtitle}>
      {/* En pantallas angostas la barra no se queda fija: ocuparía demasiado espacio */}
      <style>{`@media (max-width: 760px) { .reportes-sticky { position: static !important; } }`}</style>

      {/* ── Barra fija: periodo + exportar + pestañas ── */}
      <div className="reportes-sticky" style={s.stickyHeader}>
        <div style={s.filterBar}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {PERIODOS.map((p) => (
              <button key={p.value} type="button" aria-pressed={periodo === p.value} onClick={() => handleSelectPeriodo(p.value)} style={{ ...s.chip, background: periodo === p.value ? "rgba(45,106,79,.18)" : "transparent", borderColor: periodo === p.value ? "rgba(45,106,79,.55)" : "var(--border)", color: periodo === p.value ? "var(--text)" : "var(--muted)" }}>
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
              <button type="button" onClick={handleAplicar} disabled={loading} style={s.btnPrimary}>
                {loading ? "Cargando…" : "Aplicar"}
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginLeft: "auto" }}>
            <button type="button" onClick={() => handleExportar("periodo")} disabled={!data || exportando !== null} style={s.btnSecondary}>
              {exportando === "periodo" ? "Exportando…" : "Exportar periodo actual"}
            </button>
            <button type="button" onClick={() => handleExportar("todo")} disabled={exportando !== null} style={s.btnSecondary}>
              {exportando === "todo" ? "Exportando…" : "Exportar todo"}
            </button>
          </div>
        </div>
        {data && <Tabs tabs={TABS} active={tab} onChange={setTab} />}
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── Estado vacío ── */}
      {!data && !loading && !error && (
        <div style={s.emptyState}>
          <div style={s.emptyIconWrap}>
            <Icon name="report" variant="dark" size={40} />
          </div>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            Selecciona un periodo para ver el reporte.
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

      {/* ── Contenido de la pestaña activa ── */}
      {data && (
        <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          {tab === "ventas" && <VentasTab data={data} />}
          {tab === "inventario" && <InventarioTab data={data} />}
          {tab === "clientes" && <ClientesDeudasTab data={data} />}
        </div>
      )}
    </StaffShell>
  );
}
