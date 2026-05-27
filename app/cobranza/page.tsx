"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

type Deudor = {
  id_venta: number;
  id_usuario: number;
  nombre_cliente: string;
  correo: string;
  fecha_venta: string;
  fecha_limite_pago: string | null;
  estado_venta: string;
  total_venta: string;
  total_pagado: string;
  deuda_pendiente: string;
  dias_atraso: number;
  estado_cobro: string;
};

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;

function q(n: string | number) {
  return Number(n).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-GT");
}

function badgeEstado(estado: string): React.CSSProperties {
  if (estado === "CRITICO") {
    return { background: "rgba(220,53,69,0.15)", color: "#ff6b6b" };
  }
  if (estado === "VENCIDO") {
    return { background: "rgba(255,193,7,0.15)", color: "#ffc107" };
  }
  return { background: "rgba(45,106,79,0.15)", color: "#52b788" };
}

export default function CobranzaPage() {
  const usuario = useStaffSession();
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Deudor | null>(
    null
  );
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]>("EFECTIVO");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/deudores");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar las deudas");
        setDeudores([]);
        return;
      }
      setDeudores(data.deudores || []);
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario) cargar();
  }, [usuario, cargar]);

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!ventaSeleccionada) return;

    setGuardando(true);
    setMensaje("");
    setError("");

    const res = await fetch("/api/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_venta: ventaSeleccionada.id_venta,
        monto: Number(monto),
        metodo,
      }),
    });

    const data = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(data.error || "No se pudo registrar el pago");
      return;
    }

    setMensaje(
      data.deuda_pendiente <= 0
        ? "Pago registrado. Deuda saldada."
        : `Pago registrado. Saldo pendiente: Q${q(data.deuda_pendiente)}`
    );
    setVentaSeleccionada(null);
    setMonto("");
    cargar();
  }

  function abrirPago(d: Deudor) {
    setVentaSeleccionada(d);
    setMonto(String(Number(d.deuda_pendiente)));
    setMetodo("EFECTIVO");
    setMensaje("");
    setError("");
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.45rem 0.6rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--background)",
    color: "var(--foreground)",
  };

  if (!usuario) {
    return (
      <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>
    );
  }

  return (
    <StaffShell
      usuario={usuario}
      title="Cobranza"
      subtitle="Deudas pendientes y registro de pagos"
    >
      {mensaje && (
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>
          {mensaje}
        </p>
      )}
      {error && (
        <p style={{ color: "#ff6b6b", marginBottom: "1rem", fontWeight: 600 }}>
          {error}
        </p>
      )}

      {ventaSeleccionada && (
        <form
          onSubmit={registrarPago}
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            maxWidth: 420,
          }}
        >
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
            Registrar pago — venta #{ventaSeleccionada.id_venta}
          </h3>
          <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            {ventaSeleccionada.nombre_cliente} · pendiente Q
            {q(ventaSeleccionada.deuda_pendiente)}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <label style={{ fontSize: "0.82rem" }}>
              Monto (Q)
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                style={{ ...inputStyle, width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: "0.82rem" }}>
              Método
              <select
                value={metodo}
                onChange={(e) =>
                  setMetodo(e.target.value as (typeof METODOS)[number])
                }
                style={{ ...inputStyle, width: "100%", marginTop: 4 }}
              >
                {METODOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <button
                type="submit"
                disabled={guardando}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 6,
                  border: "none",
                  background: "#2d6a4f",
                  color: "#fff",
                  cursor: guardando ? "wait" : "pointer",
                }}
              >
                {guardando ? "Guardando…" : "Registrar pago"}
              </button>
              <button
                type="button"
                onClick={() => setVentaSeleccionada(null)}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.88rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.6rem" }}>Venta</th>
              <th style={{ padding: "0.6rem" }}>Cliente</th>
              <th style={{ padding: "0.6rem" }}>Límite pago</th>
              <th style={{ padding: "0.6rem" }}>Estado</th>
              <th style={{ padding: "0.6rem" }}>Total</th>
              <th style={{ padding: "0.6rem" }}>Pagado</th>
              <th style={{ padding: "0.6rem" }}>Pendiente</th>
              <th style={{ padding: "0.6rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={8} style={{ padding: "1rem", color: "var(--muted)" }}>
                  Cargando deudas…
                </td>
              </tr>
            ) : deudores.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "1rem", color: "var(--muted)" }}>
                  No hay deudas pendientes.
                </td>
              </tr>
            ) : (
              deudores.map((d) => (
                <tr
                  key={d.id_venta}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "0.6rem" }}>#{d.id_venta}</td>
                  <td style={{ padding: "0.6rem" }}>{d.nombre_cliente}</td>
                  <td style={{ padding: "0.6rem" }}>
                    {fmtFecha(d.fecha_limite_pago)}
                    {d.dias_atraso > 0 && (
                      <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                        {" "}
                        ({d.dias_atraso}d)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem" }}>
                    <span
                      style={{
                        ...badgeEstado(d.estado_cobro),
                        padding: "0.15rem 0.45rem",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {d.estado_cobro}
                    </span>
                  </td>
                  <td style={{ padding: "0.6rem" }}>Q{q(d.total_venta)}</td>
                  <td style={{ padding: "0.6rem" }}>Q{q(d.total_pagado)}</td>
                  <td style={{ padding: "0.6rem", fontWeight: 600 }}>
                    Q{q(d.deuda_pendiente)}
                  </td>
                  <td style={{ padding: "0.6rem" }}>
                    <button
                      type="button"
                      onClick={() => abrirPago(d)}
                      style={{
                        padding: "0.3rem 0.65rem",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      Pagar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={cargar}
        disabled={cargando}
        style={{
          marginTop: "1rem",
          padding: "0.4rem 0.8rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--muted)",
          cursor: cargando ? "wait" : "pointer",
          fontSize: "0.82rem",
        }}
      >
        Actualizar
      </button>
    </StaffShell>
  );
}
