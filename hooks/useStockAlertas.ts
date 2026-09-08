"use client";

/* useStockAlertas
   Hook de polling para las alertas de stock bajo mínimo, gateado al rol
   dueño. Reutiliza /api/gestion-inventario/stock-minimo (el mismo endpoint
   que ya consume app/inventario/page.tsx) para no duplicar lógica de
   backend, y sigue el mismo patrón de polling que VentaToastListener. */

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 30000; // stock cambia con menos frecuencia que las ventas

export type StockAlerta = {
  id_bodega: number;
  nombre_bodega: string;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
  cantidad_disponible: number | string;
  stock_minimo: number | string;
  diferencia: number | string;
  ultima_actualizacion: string;
};

type StockAlertasResponse = {
  alertas: StockAlerta[];
  total: number;
};

export function useStockAlertas(enabled: boolean) {
  const [alertas, setAlertas] = useState<StockAlerta[]>([]);
  const [nuevas, setNuevas] = useState<StockAlerta[]>([]);
  const vistosRef = useRef<Set<number>>(new Set());
  const inicializadoRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/gestion-inventario/stock-minimo");
      if (!res.ok) return; // p.ej. 403 si no aplica al rol actual

      const data: StockAlertasResponse = await res.json();
      setAlertas(data.alertas);

      const idsActuales = new Set(data.alertas.map((a) => a.id_producto));

      if (!inicializadoRef.current) {
        // Primer poll: solo establece la línea base, no dispara toasts de
        // productos que ya estaban bajo mínimo antes de abrir el panel.
        inicializadoRef.current = true;
        vistosRef.current = idsActuales;
        return;
      }

      const primeraVez = data.alertas.filter((a) => !vistosRef.current.has(a.id_producto));
      if (primeraVez.length > 0) {
        setNuevas((prev) => [...prev, ...primeraVez]);
      }
      vistosRef.current = idsActuales;
    } catch {
      // Silencioso a propósito, igual que VentaToastListener: un fallo de
      // red en el polling no debe interrumpir al dueño con errores.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, poll]);

  const descartarNueva = useCallback((idProducto: number) => {
    setNuevas((prev) => prev.filter((a) => a.id_producto !== idProducto));
  }, []);

  return {
    /** Todas las alertas activas ahora mismo (para el badge del sidebar). */
    alertas,
    /** Alertas que acaban de aparecer desde el último poll (para toasts). */
    nuevas,
    descartarNueva,
  };
}
