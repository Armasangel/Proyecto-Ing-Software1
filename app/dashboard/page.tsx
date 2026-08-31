"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { Icon, type IconName } from "@/components/Icon";

export default function DashboardPage() {
  const usuario = useStaffSession();

  const [stats, setStats] = useState({
    productos: 0,
    ventas: 0,
    pendientes: 0,
    proveedores: 0,
    clientesBloqueados: 0,
  });
  const [statsError, setStatsError] = useState(false);

  const loadStats = useCallback(() => {
    if (!usuario) return;
    fetch("/api/stats")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.stats) throw new Error("stats unavailable");
        setStats(d.stats);
        setStatsError(false);
      })
      .catch(() => {
        setStatsError(true);
      });
  }, [usuario]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!usuario) {
    return <div className="p-8 text-ink-muted">Cargando…</div>;
  }

  const STATS_CONFIG = [
    {
      label: "Productos activos",
      value: stats.productos,
      icon: "box",
      cardBg: "bg-market-50",
      iconBg: "bg-market/15",
      valueClass: "text-market-600",
    },
    {
      label: "Ventas registradas",
      value: stats.ventas,
      icon: "bill",
      cardBg: "bg-mango-50",
      iconBg: "bg-mango/20",
      valueClass: "text-mango-600",
    },
    {
      label: "Ventas pendientes",
      value: stats.pendientes,
      icon: "hourglass",
      cardBg: "bg-achiote-50",
      iconBg: "bg-achiote/15",
      valueClass: "text-achiote-600",
    },
    {
      label: "Proveedores",
      value: stats.proveedores,
      icon: "truck",
      cardBg: "bg-cream-100",
      iconBg: "bg-ink/10",
      valueClass: "text-ink",
    },
  ] as const;

  return (
    <StaffShell
      usuario={usuario}
      title="Dashboard"
      subtitle={`Hola, ${usuario.nombre.split(" ")[0]} — ${new Date().toLocaleDateString("es-GT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}`}
    >
      {/* ── Stat cards ── */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
        {statsError ? (
          <div className="col-span-full rounded-card p-9 border border-[var(--border)] bg-white flex flex-col items-center justify-center text-center gap-2.5 shadow-warm min-h-[180px]">
            <div className="font-head font-bold text-ink text-base">No se pudieron cargar las estadísticas</div>
            <div className="text-sm text-ink-muted max-w-[420px] leading-relaxed">
              Los contadores no están disponibles.
            </div>
            <button
              type="button"
              onClick={loadStats}
              className="mt-1 bg-transparent border border-market text-market-600 font-semibold text-sm rounded-control px-4 py-2 transition-transform active:scale-[0.97] hover:bg-market-50"
            >
              Reintentar
            </button>
            <div className="text-xs text-ink-muted max-w-[420px] leading-snug">
              También puedes recargar la página. Si el problema continúa, contacta al administrador.
            </div>
          </div>
        ) : (
          STATS_CONFIG.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.cardBg} rounded-card p-5 border border-[var(--border)] flex flex-col gap-2 shadow-warm transition-transform hover:-translate-y-0.5`}
            >
              <div className={`${stat.iconBg} w-11 h-11 rounded-control flex items-center justify-center mb-1`}>
                <Icon name={stat.icon as IconName} variant="dark" size={24} />
              </div>
              <div className={`font-head text-[2rem] font-extrabold leading-none ${stat.valueClass}`}>
                {stat.value.toLocaleString("es-GT")}
              </div>
              <div className="text-[0.8rem] text-ink-muted font-medium">{stat.label}</div>
            </div>
          ))
        )}
      </div>

      {/* ── Avisos ── */}
      {!statsError && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-market-50 border border-market/20 rounded-card px-5 py-4 flex items-center gap-3.5 flex-1 min-w-[200px]">
            <div className="w-2.5 h-2.5 rounded-full bg-market shrink-0 shadow-[0_0_0_3px_rgba(76,154,42,0.2)]" />
            <div>
              <div className="font-bold text-ink text-[0.88rem]">Sistema activo</div>
              <div className="text-[0.78rem] text-ink-muted mt-0.5">
                Inventario y ventas funcionando correctamente
              </div>
            </div>
          </div>
          {stats.pendientes > 0 && (
            <div className="bg-mango-50 border border-mango/25 rounded-card px-5 py-4 flex items-center gap-3.5 flex-1 min-w-[200px]">
              <span className="text-[1.1rem]">⚠️</span>
              <div>
                <div className="font-bold text-ink text-[0.88rem]">
                  {stats.pendientes} venta{stats.pendientes !== 1 ? "s" : ""} pendiente
                  {stats.pendientes !== 1 ? "s" : ""}
                </div>
                <Link href="/ventas" className="text-[0.78rem] text-mango-600 font-semibold no-underline mt-0.5 block hover:underline">
                  Ver detalles →
                </Link>
              </div>
            </div>
          )}
          {stats.clientesBloqueados > 0 && (
            <div className="bg-achiote-50 border border-achiote/25 rounded-card px-5 py-4 flex items-center gap-3.5 flex-1 min-w-[200px]">
              <span className="text-[1.1rem]">🔒</span>
              <div>
                <div className="font-bold text-ink text-[0.88rem]">
                  {stats.clientesBloqueados} cliente{stats.clientesBloqueados !== 1 ? "s" : ""}{" "}
                  bloqueado{stats.clientesBloqueados !== 1 ? "s" : ""} por deuda
                </div>
                <Link href="/deudas" className="text-[0.78rem] text-achiote-600 font-semibold no-underline mt-0.5 block hover:underline">
                  Ver en Deudas →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </StaffShell>
  );
}
