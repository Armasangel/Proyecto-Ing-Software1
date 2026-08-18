"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { isDuenoTipo } from "@/lib/roles";
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
    return (
      <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>
    );
  }

  const STATS_CONFIG = [
    {
      label: "Productos activos",
      value: stats.productos,
      icon: "box",
      bg: "#EEF1FB",
      iconBg: "rgba(29, 36, 202, 0.1)",
      valueColor: "#1D24CA",
    },
    {
      label: "Ventas registradas",
      value: stats.ventas,
      icon: "bill",
      bg: "#EEF1FB",
      iconBg: "rgba(32, 22, 88, 0.1)",
      valueColor: "#201658",
    },
    {
      label: "Ventas pendientes",
      value: stats.pendientes,
      icon: "hourglass",
      bg: "#EEF1FB",
      iconBg: "rgba(152, 171, 238, 0.3)",
      valueColor: "#1D24CA",
    },
    {
      label: "Proveedores",
      value: stats.proveedores,
      icon: "truck",
      bg: "#EEF1FB",
      iconBg: "rgba(152, 171, 238, 0.2)",
      valueColor: "#201658",
    },
  ];

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
      <div style={s.statsGrid}>
        {statsError ? (
          <div style={s.statsErrorCard}>
            <div style={s.statsErrorTitle}>No se pudieron cargar las estadísticas</div>
            <div style={s.statsErrorBody}>
              Los contadores no están disponibles.
            </div>
            <button type="button" onClick={loadStats} style={s.statsErrorBtn}>
              Reintentar
            </button>
            <div style={s.statsErrorHint}>
              También puedes recargar la página. Si el problema continúa, contacta al
              administrador.
            </div>
          </div>
        ) : (
          STATS_CONFIG.map((stat) => (
            <div key={stat.label} style={{ ...s.statCard, background: stat.bg }}>
              <div style={{ ...s.statIconWrap, background: stat.iconBg }}>
                <Icon name={stat.icon as IconName} variant="dark" size={24} />
              </div>
              <div style={{ ...s.statValue, color: stat.valueColor }}>
                {stat.value.toLocaleString("es-GT")}
              </div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          ))
        )}
      </div>

      {/* ── Notification card (matches reference image) ── */}
      {!statsError && (
        <div style={s.notifRow}>
          <div style={s.notifCard}>
            <div style={s.notifDot} />
            <div>
              <div style={s.notifTitle}>Sistema activo</div>
              <div style={s.notifSub}>
                Inventario y ventas funcionando correctamente
              </div>
            </div>
          </div>
          {stats.pendientes > 0 && (
            <div style={s.alertCard}>
              <span style={{ fontSize: "1.1rem" }}>⚠️</span>
              <div>
                <div style={s.alertTitle}>
                  {stats.pendientes} venta{stats.pendientes !== 1 ? "s" : ""} pendiente
                  {stats.pendientes !== 1 ? "s" : ""}
                </div>
                <Link href="/ventas" style={s.alertLink}>
                  Ver detalles →
                </Link>
              </div>
            </div>
          )}
          {stats.clientesBloqueados > 0 && (
            <div style={s.alertCard}>
              <span style={{ fontSize: "1.1rem" }}>🔒</span>
              <div>
                <div style={s.alertTitle}>
                  {stats.clientesBloqueados} cliente{stats.clientesBloqueados !== 1 ? "s" : ""}{" "}
                  bloqueado{stats.clientesBloqueados !== 1 ? "s" : ""} por deuda
                </div>
                <Link href="/deudas" style={s.alertLink}>
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

const s: Record<string, React.CSSProperties> = {
  /* Stats */
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },

  statCard: {
    borderRadius: 14,
    padding: "1.35rem 1.25rem",
    border: "1px solid #C5CEED",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    boxShadow: "0 2px 8px rgba(29, 36, 202, 0.06)",
  },

  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "0.25rem",
  },

  statValue: {
    fontFamily: "var(--font-head)",
    fontSize: "2rem",
    fontWeight: 800,
    lineHeight: 1,
    color: "#1D24CA",
  },

  statLabel: {
    fontSize: "0.8rem",
    color: "#5a6495",
    fontWeight: 500,
  },

  statsErrorCard: {
    gridColumn: "1 / -1",
    borderRadius: 14,
    padding: "2.25rem 1.5rem",
    border: "1px solid #C5CEED",
    background: "#EEF1FB",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: "0.65rem",
    boxShadow: "0 2px 8px rgba(29, 36, 202, 0.06)",
    minHeight: 180,
  },

  statsErrorTitle: {
    fontFamily: "var(--font-head)",
    fontWeight: 700,
    color: "#201658",
    fontSize: "1.05rem",
  },

  statsErrorBody: {
    fontSize: "0.88rem",
    color: "#5a6495",
    maxWidth: 420,
    lineHeight: 1.45,
  },

  statsErrorBtn: {
    marginTop: "0.25rem",
    background: "transparent",
    border: "1px solid #1D24CA",
    color: "#1D24CA",
    fontWeight: 600,
    fontSize: "0.85rem",
    borderRadius: 8,
    padding: "0.5rem 1.1rem",
    cursor: "pointer",
  },

  statsErrorHint: {
    fontSize: "0.78rem",
    color: "#5a6495",
    maxWidth: 420,
    lineHeight: 1.4,
  },

  /* Quick actions */
  section: {
    marginBottom: "2rem",
  },

  sectionTitle: {
    fontFamily: "var(--font-head)",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#5a6495",
    marginBottom: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "0.75rem",
  },

  actionCard: {
    background: "#ffffff",
    border: "1px solid #C5CEED",
    borderRadius: 12,
    padding: "1.1rem 1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    textDecoration: "none",
    transition: "border-color .15s, box-shadow .15s, transform .15s",
    position: "relative",
    overflow: "hidden",
  },

  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "#EEF1FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "0.15rem",
  },

  actionLabel: {
    fontWeight: 600,
    color: "#201658",
    fontSize: "0.88rem",
  },

  actionArrow: {
    fontSize: "0.78rem",
    color: "#98ABEE",
    fontWeight: 700,
  },

  /* Notification row */
  notifRow: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
  },

  notifCard: {
    background: "#EEF1FB",
    border: "1px solid #C5CEED",
    borderRadius: 12,
    padding: "1rem 1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    flex: "1 1 200px",
  },

  notifDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#1D24CA",
    flexShrink: 0,
    boxShadow: "0 0 0 3px rgba(29, 36, 202, 0.2)",
  },

  notifTitle: {
    fontWeight: 700,
    color: "#201658",
    fontSize: "0.88rem",
  },

  notifSub: {
    fontSize: "0.78rem",
    color: "#5a6495",
    marginTop: "0.15rem",
  },

  alertCard: {
    background: "rgba(249, 232, 201, 0.8)",
    border: "1px solid rgba(29, 36, 202, 0.2)",
    borderRadius: 12,
    padding: "1rem 1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    flex: "1 1 200px",
  },

  alertTitle: {
    fontWeight: 700,
    color: "#201658",
    fontSize: "0.88rem",
  },

  alertLink: {
    fontSize: "0.78rem",
    color: "#1D24CA",
    fontWeight: 600,
    textDecoration: "none",
    marginTop: "0.15rem",
    display: "block",
  },
};