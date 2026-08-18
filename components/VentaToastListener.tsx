"use client";

/* VentaToastListener
   Le avisa al dueño con un toast cuando un empleado registra una venta,
   sin importar en qué página del panel esté.

   Cómo funciona: como el proyecto no tiene WebSockets/SSE, hacemos polling
   corto a /api/ventas/recientes cada POLL_MS. El primer fetch solo anota
   el id de venta más alto que ya existe (no dispara toasts de ventas
   viejas); desde ahí, cada fetch pregunta "¿hay ventas con id mayor al
   último que vi?" y si las hay, las apila como toasts. */

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 8000;

type VentaReciente = {
  id_venta: number;
  total: number | string;
  fecha_venta: string;
  nombre_empleado: string | null;
};

type ToastItem = VentaReciente & { toastKey: string };

const TOAST_DURATION_MS = 6000;

export function VentaToastListener() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const ultimoIdRef = useRef<number | null>(null);
  const inicializadoRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const desde = ultimoIdRef.current;
      const url = desde ? `/api/ventas/recientes?desde=${desde}` : "/api/ventas/recientes";
      const res = await fetch(url);
      if (!res.ok) return; // p.ej. 403 si por alguna razón no es dueño; simplemente no mostramos nada

      const data: { ventas: VentaReciente[]; ultimo_id: number } = await res.json();
      ultimoIdRef.current = data.ultimo_id;

      if (!inicializadoRef.current) {
        // Primer poll: solo establece el punto de partida, no muestra toasts
        // de ventas que ya existían antes de que el dueño abriera la página.
        inicializadoRef.current = true;
        return;
      }

      if (data.ventas.length > 0) {
        const nuevos = data.ventas.map((v) => ({ ...v, toastKey: `${v.id_venta}-${Date.now()}` }));
        setToasts((prev) => [...prev, ...nuevos]);
        nuevos.forEach((t) => {
          setTimeout(() => {
            setToasts((prev) => prev.filter((x) => x.toastKey !== t.toastKey));
          }, TOAST_DURATION_MS);
        });
      }
    } catch {
      // Silencioso a propósito: un fallo de red en el polling no debe
      // interrumpir al dueño con errores mientras trabaja en el panel.
    }
  }, []);

  useEffect(() => {
    poll(); // primer fetch inmediato, establece el punto de partida
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  if (toasts.length === 0) return null;

  return (
    <div style={s.container}>
      {toasts.map((t) => (
        <div key={t.toastKey} style={s.toast}>
          <div style={s.icon}>🛎️</div>
          <div>
            <div style={s.title}>Venta realizada</div>
            <div style={s.body}>
              {t.nombre_empleado ?? "Un colaborador"} registró una venta de{" "}
              <strong>Q{Number(t.total).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "2rem",
    right: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    zIndex: 400,
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.6rem",
    padding: "0.85rem 1.1rem",
    borderRadius: "var(--radius, 10px)",
    background: "rgba(63,185,80,.15)",
    border: "1px solid rgba(63,185,80,.4)",
    backdropFilter: "blur(8px)",
    boxShadow: "var(--shadow, 0 4px 16px rgba(0,0,0,.25))",
    maxWidth: 320,
  },
  icon: {
    fontSize: "1.1rem",
    lineHeight: 1,
  },
  title: {
    fontWeight: 700,
    fontSize: "0.85rem",
    color: "var(--green, #3fb950)",
    marginBottom: "0.15rem",
  },
  body: {
    fontSize: "0.85rem",
    color: "var(--fg, #e6e6e6)",
  },
};