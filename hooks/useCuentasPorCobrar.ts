"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStaffSession } from "@/hooks/useStaffSession";
import { matchesQuery, paginar, type PageSize } from "@/lib/ui-table";
import { reglaDePago, type ReglaPago } from "@/lib/credito";
import type { ClienteCreado } from "@/lib/clientes-form";
import type { Alerta, Cliente, Deuda, FiltroVencimiento } from "@/lib/types/cuentas-por-cobrar";
import { cumpleFiltroVencimiento } from "@/lib/cuentas-por-cobrar-utils";

export type GrupoCliente = {
  key: string;
  id_cliente: number | null;
  nombre: string;
  telefono: string | null;
  cliente: Cliente | undefined;
  cliente_puede_comprar: boolean | null;
  limite_deuda: number | null;
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

  async function guardarNotifConfig(cambios: { activo?: boolean; intervalo_dias?: number }) {
    setNotifGuardando(true);
    setNotifError("");
    setNotifMensaje("");
    try {
      const res = await fetch("/api/configuracion/notificaciones-deuda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifError(data.error || "No se pudo guardar la configuración");
        if (notifConfig) setNotifIntervaloInput(String(notifConfig.intervalo_dias));
      } else {
        setNotifConfig(data.configuracion);
        setNotifIntervaloInput(String(data.configuracion.intervalo_dias));
        setNotifMensaje("Configuración guardada.");
      }
    } catch {
      setNotifError("Error de conexión");
    } finally {
      setNotifGuardando(false);
    }
  }

  async function ejecutarNotifAhora() {
    setNotifEjecutando(true);
    setNotifError("");
    setNotifMensaje("");
    try {
      const res = await fetch("/api/configuracion/notificaciones-deuda/ejecutar-ahora", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifError(data.error || "No se pudo ejecutar la corrida");
      } else if (!data.activo) {
        setNotifError("El envío automático está desactivado — actívalo primero para poder enviar.");
      } else {
        setNotifMensaje(
          `Corrida terminada: ${data.enviados} enviado${data.enviados === 1 ? "" : "s"}` +
            (data.fallidos > 0
              ? `, ${data.fallidos} fallido${data.fallidos === 1 ? "" : "s"}`
              : "") +
            (data.procesados === 0
              ? " (nadie tenía un recordatorio pendiente en este momento)."
              : ".")
        );
      }
    } catch {
      setNotifError("Error de conexión");
    } finally {
      setNotifEjecutando(false);
    }
  }

  function mostrarAlerta(alerta: Alerta | null) {
    if (!alerta) return;
    if (alerta.bloqueado) {
      setAlertaBloqueo(
        `⚠️ Este cliente alcanzó su límite de crédito (Q${alerta.limite_deuda?.toFixed(2)}). ` +
          `Saldo por cobrar: Q${alerta.deuda_pendiente.toFixed(2)}. Ya no puede comprar ni hacer pedidos.`
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
          cliente_puede_comprar: d.cliente_puede_comprar,
          limite_deuda: d.limite_deuda ? Number(d.limite_deuda) : null,
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
    return Array.from(map.values()).sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [deudas, clientes]);

  const grupos = useMemo(() => agruparPorCliente(), [agruparPorCliente]);

  const gruposFiltrados = useMemo(() => {
    return grupos.filter((g) => {
      if (soloBloqueados && g.cliente_puede_comprar !== false) return false;
      return matchesQuery(qDeudas, g.nombre, g.telefono);
    });
  }, [grupos, qDeudas, soloBloqueados]);

  const gruposPage = useMemo(
    () => paginar(gruposFiltrados, page, perPage),
    [gruposFiltrados, page, perPage]
  );

  const deudasPorVencer = useMemo(() => {
    return deudas
      .filter((d) => d.estado_deuda === "PENDIENTE")
      .slice()
      .sort((a, b) => {
        if (!a.fecha_limite_pago && !b.fecha_limite_pago) return 0;
        if (!a.fecha_limite_pago) return 1;
        if (!b.fecha_limite_pago) return -1;
        return a.fecha_limite_pago.localeCompare(b.fecha_limite_pago);
      });
  }, [deudas]);

  const vencimientoFiltrado = useMemo(() => {
    return deudasPorVencer.filter((d) => {
      if (soloBloqueados && d.cliente_puede_comprar !== false) return false;
      if (!cumpleFiltroVencimiento(d.fecha_limite_pago, filtroVencimiento)) return false;
      return matchesQuery(qDeudas, d.nombre_deudor, d.telefono_deudor);
    });
  }, [deudasPorVencer, qDeudas, soloBloqueados, filtroVencimiento]);

  const vencimientoPage = useMemo(
    () => paginar(vencimientoFiltrado, page, perPage),
    [vencimientoFiltrado, page, perPage]
  );

  const clientesFiltradosLimites = useMemo(() => {
    return clientes.filter((c) => {
      if (soloBloqueados && c.estado_cliente) return false;
      return matchesQuery(
        qLimites,
        c.nombre,
        c.codigo_cliente,
        c.telefono,
        c.correo,
        c.nit_cliente,
        c.direccion,
        c.codigo_postal
      );
    });
  }, [clientes, qLimites, soloBloqueados]);

  const clientesPage = useMemo(
    () => paginar(clientesFiltradosLimites, page, perPage),
    [clientesFiltradosLimites, page, perPage]
  );

  const clienteSeleccionado = clientes.find((c) => String(c.id_cliente) === form.id_cliente);

  function deudaPendienteDe(id_cliente: number): number {
    return deudas
      .filter((d) => d.id_cliente === id_cliente && d.estado_deuda === "PENDIENTE")
      .reduce((acc, d) => acc + Number(d.monto_total), 0);
  }

  function seleccionarCliente(c: Cliente) {
    setForm((f) => ({ ...f, id_cliente: String(c.id_cliente) }));
  }

  async function registrarClienteCreado(
    nuevo: ClienteCreado,
    { deudaInicial }: { deudaInicial: number | null },
    seleccionar = true
  ): Promise<void> {
    const cliente = nuevo as Cliente;
    setError("");

    if (deudaInicial !== null) {
      const resDeuda = await fetch("/api/deudas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_deudor: cliente.nombre,
          telefono_deudor: cliente.telefono,
          fecha_inicio: new Date().toISOString().slice(0, 10),
          id_cliente: cliente.id_cliente,
          monto_libre: deudaInicial,
        }),
      });
      if (resDeuda.ok) {
        const dataDeuda = await resDeuda.json();
        mostrarAlerta(dataDeuda.alerta);
        cargarDeudas();
      } else {
        const dataErr = await resDeuda.json().catch(() => ({}));
        setError(
          `Cliente creado, pero no se pudo registrar el saldo inicial: ${
            dataErr.error || "error desconocido"
          }`
        );
      }
    }

    setClientes((prev) => [...prev, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setLimitesEditando((prev) => ({ ...prev, [cliente.id_cliente]: cliente.limite_deuda ?? "" }));
    if (seleccionar) setForm((f) => ({ ...f, id_cliente: String(cliente.id_cliente) }));
    setCreandoCliente(false);
  }

  async function guardarLimite(id_cliente: number) {
    setGuardandoLimiteId(id_cliente);
    setAlertaBloqueo("");
    const valor = limitesEditando[id_cliente] ?? "";
    const res = await fetch(`/api/clientes/${id_cliente}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limite_deuda: valor === "" ? null : valor }),
    });
    if (res.ok) {
      const data = await res.json();
      mostrarAlerta(data.alerta);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar el límite.");
    }
    setGuardandoLimiteId(null);
  }

  function cerrarFormularioDeuda() {
    setCreando(false);
    setForm({ id_cliente: "", monto: "", fecha_limite_pago: "" });
  }

  async function crearDeuda() {
    setError("");
    setAlertaBloqueo("");

    if (!clienteSeleccionado) {
      setError("Selecciona (o crea) el cliente al que se le asigna el saldo anterior.");
      return;
    }
    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El saldo anterior debe ser un monto mayor a 0.");
      return;
    }

    const res = await fetch("/api/deudas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_deudor: clienteSeleccionado.nombre,
        telefono_deudor: clienteSeleccionado.telefono,
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_limite_pago: form.fecha_limite_pago || null,
        id_cliente: clienteSeleccionado.id_cliente,
        monto_libre: monto,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setMensaje("Saldo anterior registrado.");
      cerrarFormularioDeuda();
      mostrarAlerta(data.alerta);
      cargarDeudas();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al registrar el saldo anterior.");
    }
  }

  async function cambiarEstado(id_deuda: number) {
    setCambiandoId(id_deuda);
    setAlertaBloqueo("");
    const res = await fetch(`/api/deudas/${id_deuda}`, { method: "PATCH" });
    if (res.ok) {
      const data = await res.json();
      mostrarAlerta(data.alerta);
      cargarDeudas();
    } else {
      setError("No se pudo cambiar el estado de la cuenta por cobrar.");
    }
    setCambiandoId(null);
  }

  function reglaDe(d: Deuda): ReglaPago | null {
    return d.estado_deuda === "PENDIENTE" && d.cuotas && d.cuotas.length > 0
      ? reglaDePago(d.cuotas)
      : null;
  }

  function abrirPago(id_deuda: number) {
    const d = deudas.find((x) => x.id_deuda === id_deuda);
    const regla = d ? reglaDe(d) : null;
    setPagandoId(id_deuda);
    setMontoPago(regla ? regla.minimo.toFixed(2) : "");
    setMetodoPago("EFECTIVO");
    setErrorPago("");
  }

  function cerrarPago() {
    setPagandoId(null);
    setMontoPago("");
    setErrorPago("");
  }

  async function registrarPago(id_deuda: number) {
    const monto = Number(montoPago);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorPago("Ingresa un monto válido, mayor a 0.");
      return;
    }
    const d = deudas.find((x) => x.id_deuda === id_deuda);
    const regla = d ? reglaDe(d) : null;
    if (regla && Math.round(monto * 100) < Math.round(regla.minimo * 100)) {
      setErrorPago(
        regla.pagoUnico
          ? `Esta cuenta es de pago único: debe pagarse completa (Q${regla.minimo.toFixed(2)}).`
          : `El pago mínimo es Q${regla.minimo.toFixed(2)} (pago ${regla.cuota?.numero} de ${regla.totalCuotas}).`
      );
      return;
    }
    setGuardandoPago(true);
    setErrorPago("");
    setAlertaBloqueo("");
    try {
      const res = await fetch(`/api/deudas/${id_deuda}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, metodo_pago: metodoPago }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorPago(data.error || "No se pudo registrar el pago.");
        return;
      }
      mostrarAlerta(data.alerta);
      cerrarPago();
      await cargarDeudas();
    } catch {
      setErrorPago("No se pudo conectar con el servidor.");
    } finally {
      setGuardandoPago(false);
    }
  }

  function toggleExpandido(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return {
    usuario,
    tab,
    setTab,
    vista,
    setVista,
    deudas,
    setDeudas,
    clientes,
    setClientes,
    creando,
    setCreando,
    form,
    setForm,
    mensaje,
    setMensaje,
    error,
    setError,
    alertaBloqueo,
    setAlertaBloqueo,
    cambiandoId,
    setCambiandoId,
    expandidos,
    setExpandidos,
    pagandoId,
    setPagandoId,
    montoPago,
    setMontoPago,
    metodoPago,
    setMetodoPago,
    guardandoPago,
    setGuardandoPago,
    errorPago,
    setErrorPago,
    notifConfig,
    setNotifConfig,
    notifIntervaloInput,
    setNotifIntervaloInput,
    notifGuardando,
    setNotifGuardando,
    notifEjecutando,
    setNotifEjecutando,
    notifMensaje,
    setNotifMensaje,
    notifError,
    setNotifError,
    creandoCliente,
    setCreandoCliente,
    limitesEditando,
    setLimitesEditando,
    guardandoLimiteId,
    setGuardandoLimiteId,
    qDeudas,
    setQDeudas,
    qLimites,
    setQLimites,
    soloBloqueados,
    setSoloBloqueados,
    filtroVencimiento,
    setFiltroVencimiento,
    page,
    setPage,
    perPage,
    setPerPage,
    cargarDeudas,
    cargarClientes,
    cargarNotifConfig,
    guardarNotifConfig,
    ejecutarNotifAhora,
    mostrarAlerta,
    grupos,
    gruposFiltrados,
    gruposPage,
    deudasPorVencer,
    vencimientoFiltrado,
    vencimientoPage,
    clientesFiltradosLimites,
    clientesPage,
    clienteSeleccionado,
    deudaPendienteDe,
    seleccionarCliente,
    registrarClienteCreado,
    guardarLimite,
    cerrarFormularioDeuda,
    crearDeuda,
    cambiarEstado,
    reglaDe,
    abrirPago,
    cerrarPago,
    registrarPago,
    toggleExpandido,
    paginar,
  };
}

export type CuentasPorCobrarController = ReturnType<typeof useCuentasPorCobrar>;
