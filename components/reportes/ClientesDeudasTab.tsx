import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EmptyChart } from "./charts";
import { s } from "./styles";
import type { EstadisticasData } from "./types";
import { Card, ProgressCard, StatCard } from "./ui";
import { q } from "./utils";

export function ClientesDeudasTab({ data }: { data: EstadisticasData }) {
  const d = data.deudas.resumen;
  const k = data.kpis;
  const top = data.deudas.top_deudores.slice(0, 5);
  const hayMas = data.deudas.top_deudores.length > top.length || d.cantidad_deudores > top.length;

  return (
    <div style={s.tabStack}>

      {/* Arriba: lo que te deben y lo que está pendiente */}
      <p style={s.note}>La deuda se muestra tal como está hoy; no cambia con el periodo que elegiste.</p>
      <div style={s.statsGrid}>
        <StatCard icon="money-bag" label="Deuda pendiente" value={q(d.deuda_pendiente_total)} sub={`${d.cantidad_deudas_pendientes} deuda${d.cantidad_deudas_pendientes !== 1 ? "s" : ""} sin pagar`} />
        <StatCard icon="ticket" label="Deudores activos" value={d.cantidad_deudores.toLocaleString("es-GT")} sub="con deuda pendiente" />
        <StatCard icon="close" label="Clientes bloqueados" value={d.clientes_bloqueados.toLocaleString("es-GT")} sub="alcanzaron su límite de deuda" />
        <ProgressCard icon="debt" label="Fiado cobrado" value={`${k.deuda.tasa_recuperacion}%`} pct={k.deuda.tasa_recuperacion} sub="de todo lo fiado, ya te lo pagaron" />
        <StatCard icon="hand-truck" label="Pedidos abiertos" value={k.operacion.pedidos_pendientes.toLocaleString("es-GT")} sub={`${q(k.operacion.monto_pedidos_pendientes)} en pedidos sin terminar`} />
      </div>

      {/* Abajo: listas */}
      <div style={s.twoCol}>
        <Card title="Tus mejores clientes del periodo">
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
        <Card title="Quién más te debe (al día de hoy)">
          {top.length === 0 ? <EmptyChart label="No hay deudas pendientes" /> : (
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
                  {top.map((d, i) => (
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
      {hayMas && (
        <div style={{ textAlign: "right" }}>
          <Link href="/deudas" style={{ color: "var(--accent2)", fontWeight: 600, fontSize: "0.85rem" }}>Ver todas las deudas →</Link>
        </div>
      )}
    </div>
  );
}
