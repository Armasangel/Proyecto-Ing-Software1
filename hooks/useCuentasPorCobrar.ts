"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStaffSession } from "@/hooks/useStaffSession";
import { paginar, type PageSize } from "@/lib/ui-table";
import type { Alerta, Cliente, Deuda, FiltroVencimiento } from "@/lib/types/cuentas-por-cobrar";
import { cumpleFiltroVencimiento, diasRestantesNum } from "@/lib/cuentas-por-cobrar-utils";

export type GrupoCliente = {
  key: string;
  id_cliente: number | null;
  nombre: string;
  telefono: string | null;
  cliente: Cliente | undefined;
  deudas: Deuda[];
  totalPendiente: number;
  saldoPendiente: number;
  totalPagado: number;
  masAntigua: string;
  fechaLimiteMasCercana: string | null;
};

export function useCuentasPorCobrar() {
  const usuario = useStaffSession();
  const [tab, setTab] = useState<"deudas" | "limites" | "notificaciones">("deudas");
  const [vista, setVista] = useState<"acumulado" | "vencimiento">("acumulado");
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ id_cliente: "", monto: "", fecha_limite_pago: "" });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [alertaBloqueo, setAlertaBloqueo] = useState("");
  const [cambiandoId, setCambiandoId] = useState<number | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [pagandoId, setPagandoId] = useState<number | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  const [notifConfig, setNotifConfig] = useState<{ activo: boolean; intervalo_dias: number } | null>(null);
  const [notifIntervaloInput, setNotifIntervaloInput] = useState("7");
  const [notifGuardando, setNotifGuardando] = useState(false);
  const [notifEjecutando, setNotifEjecutando] = useState(false);
  const [notifMensaje, setNotifMensaje] = useState("");
  const [notifError, setNotifError] = useState("");

  const [creandoCliente, setCreandoCliente] = useState(false);
  const [limitesEditando, setLimitesEditando] = useState<Record<number, string>>({});
  const [guardandoLimiteId, setGuardandoLimiteId] = useState<number | null>(null);

  const [qDeudas, setQDeudas] = useState("");
  const [qLimites, setQLimites] = useState("");
  const [soloBloqueados, setSoloBloqueados] = useState(false);
  const [filtroVencimiento, setFiltroVencimiento] = useState<FiltroVencimiento>("todas");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

  async function cargarDeudas() {
    const res = await fetch("/api/deudas");
    const data = await res.json();
    setDeudas(data.deudas || []);
  }

  async function cargarClientes() {
    const res = await fetch("/api/clientes?todos=1");
    const data = await res.json();
    const lista: Cliente[] = data.clientes || [];
    setClientes(lista);
    setLimitesEditando((prev) => {
      const next = { ...prev };
      for (const c of lista) {
        if (!(c.id_cliente in next)) next[c.id_cliente] = c.limite_deuda ?? "";
      }
      return next;
    });
  }

  async function cargarNotifConfig() {
    try {
      const res = await fetch("/api/configuracion/notificaciones-deuda");
      const data = res.ok ? await res.json() : null;
      if (data?.configuracion) {
        setNotifConfig(data.configuracion);
        setNotifIntervaloInput(String(data.configuracion.intervalo_dias));
      } else {
        setNotifError("No se pudo cargar la configuración de los recordatorios.");
      }
    } catch {
      setNotifError("No se pudo cargar la configuración de los recordatorios.");
    }
  }

  useEffect(() => {
    cargarDeudas();
    cargarClientes();
    cargarNotifConfig();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab, vista, qDeudas, qLimites, soloBloqueados, filtroVencimiento, perPage]);

  function mostrarAlerta(alerta: Alerta | null) {
    if (!alerta) return;
    if (alerta.bloqueado) {
      setAlertaBloqueo(
        `⚠️ Este cliente alcanzó su límite de crédito (Q${alerta.limite_deuda?.toFixed(2)}). Saldo por cobrar: Q${alerta.deuda_pendiente.toFixed(2)}. Ya no puede comprar ni hacer pedidos.`
      );
    } else if (alerta.cambioEstado) {
      setAlertaBloqueo("✓ El cliente volvió a estar por debajo de su límite y puede comprar de nuevo.");
    } else {
      setAlertaBloqueo("");
    }
    cargarClientes();
  }

  const agruparPorCliente = useCallback((): GrupoCliente[] => {
    const map = new Map<string, GrupoCliente>();
    for (const d of deudas) {
      const key = d.id_cliente ? `cli:${d.id_cliente}` : `nom:${d.nombre_deudor.toLowerCase()}`;
      if (!map.has(key)) {
        const cliente = d.id_cliente ? clientes.find((c) => c.id_cliente === d.id_cliente) : undefined;
        map.set(key, {
          key,
          id_cliente: d.id_cliente,
          nombre: d.nombre_deudor,
          telefono: d.telefono_deudor,
          cliente,
          deudas: [],
          totalPendiente: 0,
          saldoPendiente: 0,
          totalPagado: 0,
          masAntigua: d.fecha_inicio,
          fechaLimiteMasCercana: d.fecha_limite_pago,
        });
      }
      const g = map.get(key)!;
      g.deudas.push(d);
      if (d.estado_deuda === "PENDIENTE") {
        g.totalPendiente += Number(d.monto_total || 0);
        g.saldoPendiente += Number(d.saldo_pendiente || d.monto_total || 0);
      }
      g.totalPagado += Number(d.total_pagado || 0);
      if (d.fecha_inicio < g.masAntigua) g.masAntigua = d.fecha_inicio;
      if (d.fecha_limite_pago) {
        if (!g.fechaLimiteMasCercana || d.fecha_limite_pago < g.fechaLimiteMasCercana) {
          g.fechaLimiteMasCercana = d.fecha_limite_pago;
        }
      }
    }
    return Array.from(map.values());
  }, [deudas, clientes]);

  const grupos = useMemo(() => agruparPorCliente(), [agruparPorCliente]);

  return {
    usuario,
    tab, setTab,
    vista, setVista,
    deudas, setDeudas,
    clientes, setClientes,
    creando, setCreando,
    form, setForm,
    mensaje, setMensaje,
    error, setError,
    alertaBloqueo, setAlertaBloqueo,
    cambiandoId, setCambiandoId,
    expandidos, setExpandidos,
    pagandoId, setPagandoId,
    montoPago, setMontoPago,
    metodoPago, setMetodoPago,
    guardandoPago, setGuardandoPago,
    errorPago, setErrorPago,
    notifConfig, setNotifConfig,
    notifIntervaloInput, setNotifIntervaloInput,
    notifGuardando, setNotifGuardando,
    notifEjecutando, setNotifEjecutando,
    notifMensaje, setNotifMensaje,
    notifError, setNotifError,
    creandoCliente, setCreandoCliente,
    limitesEditando, setLimitesEditando,
    guardandoLimiteId, setGuardandoLimiteId,
    qDeudas, setQDeudas,
    qLimites, setQLimites,
    soloBloqueados, setSoloBloqueados,
    filtroVencimiento, setFiltroVencimiento,
    page, setPage,
    perPage, setPerPage,
    cargarDeudas,
    cargarClientes,
    cargarNotifConfig,
    mostrarAlerta,
    grupos,
    paginar,
  };
}

export type CuentasPorCobrarController = ReturnType<typeof useCuentasPorCobrar>;
