"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { CantidadInput } from "@/components/CantidadInput";
import { matchesQuery, paginar, PaginationBar, type PageSize } from "@/lib/ui-table";

type ProductoDeuda = {
  id_producto: number;
  nombre_producto: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

type PagoDeuda = {
  id_pago: number;
  monto: string;
  fecha_pago: string;
  metodo_pago: string | null;
  nota: string | null;
  registrado_por: string | null;
};

type Deuda = {
  id_deuda: number;
  nombre_deudor: string;
  telefono_deudor: string | null;
  fecha_inicio: string;
  fecha_limite_pago: string | null;
  monto_total: string;
  estado_deuda: "PENDIENTE" | "PAGADA";
  productos: ProductoDeuda[];
  id_cliente: number | null;
  limite_deuda: string | null;
  cliente_puede_comprar: boolean | null;
  total_pagado: string;
  saldo_pendiente: string;
  porcentaje_cubierto: string;
  pagos: PagoDeuda[];
};

type Producto = {
  id_producto: number;
  nombre_producto: string;
  precio_unitario: string;
  unidad_medida: string;
};

type Cliente = {
  id_cliente: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  tipo_cliente: string;
  estado_cliente: boolean;
  limite_deuda: string | null;
};

type Alerta = {
  id_cliente: number;
  deuda_pendiente: number;
  limite_deuda: number | null;
  bloqueado: boolean;
  cambioEstado: boolean;
};

type LineaForm = { id_producto: string; cantidad: string };

const formVacio = {
  id_cliente: "",
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_limite_pago: "",
};

const clienteFormVacio = {
  nombre: "",
  telefono: "",
  correo: "",
  tipo_cliente: "MINORISTA",
  limite_deuda: "",
  deuda_inicial: "",
};

/**
 * Clases Tailwind reutilizables (DEV-192). Reemplazan a los antiguos helpers
 * inputStyle / badgeStyle / tabBtnStyle y a los inline styles. Los colores
 * salen de los tokens del tema (surface, surface-soft, line, ink, market,
 * success, danger, warning), que mapean a las variables CSS de globals.css.
 */
const cls = {
  input: "px-[0.6rem] py-[0.3rem] rounded-[14px] border border-line bg-surface text-ink",
  td: "p-3",             // celdas de tabla (0.75rem)
  tdSm: "p-[0.4rem]",    // celdas de la tabla de detalle (0.4rem)
  badgeBloqueado: "ml-1.5 text-[0.72rem] text-white bg-danger px-1.5 py-px rounded-lg",
};

/** Clases del pill de pestaña Acumulado/Próximas. Antes era tabBtnStyle(). */
const tabPillClass = (activo: boolean): string =>
  `px-[0.9rem] py-[0.35rem] rounded-full cursor-pointer text-[0.82rem] font-semibold border ${
    activo ? "border-success bg-success text-white" : "border-line bg-transparent text-ink"
  }`;

function diasRestantes(fecha: string | null): { texto: string; cls: string } {
  if (!fecha) return { texto: "Sin fecha límite", cls: "text-ink-muted" };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) return { texto: `Vencida hace ${Math.abs(dias)} día(s)`, cls: "text-danger" };
  if (dias === 0) return { texto: "Vence hoy", cls: "text-danger" };
  if (dias <= 3) return { texto: `Vence en ${dias} día(s)`, cls: "text-warning" };
  return { texto: `Vence en ${dias} día(s)`, cls: "text-ink-muted" };
}

function diasRestantesNum(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fecha}T00:00:00`);
  return Math.round((limite.getTime() - hoy.getTime()) / 86400000);
}

type FiltroVencimiento = "todas" | "vencidas" | "proximas" | "sin_fecha";

function cumpleFiltroVencimiento(fecha: string | null, filtro: FiltroVencimiento): boolean {
  if (filtro === "todas") return true;
  if (filtro === "sin_fecha") return !fecha;
  const dias = diasRestantesNum(fecha);
  if (dias === null) return false;
  if (filtro === "vencidas") return dias < 0;
  if (filtro === "proximas") return dias >= 0 && dias <= 3;
  return true;
}

// Barra de progreso + monto restante. El % viene calculado por el backend
// (porcentaje_cubierto), acá solo se pinta.
function SaldoCubierto({ d }: { d: Deuda }) {
  const pct = Math.max(0, Math.min(100, Number(d.porcentaje_cubierto) || 0));
  const saldo = Number(d.saldo_pendiente);
  if (d.estado_deuda === "PAGADA") {
    return <span className="text-success font-semibold text-[0.82rem]">Cubierto al 100%</span>;
  }
  return (
    <div>
      <div className="text-[0.8rem] mb-[3px]">
        <strong>Q{saldo.toFixed(2)}</strong>
        <span className="text-ink-muted"> pendiente · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-line overflow-hidden">
        <div
          className="h-full rounded-full bg-market transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Formulario inline para registrar un abono contra una deuda específica.
function FormPago({
  saldo,
  monto,
  setMonto,
  metodo,
  setMetodo,
  error,
  guardando,
  onGuardar,
  onCancelar,
}: {
  saldo: number;
  monto: string;
  setMonto: (v: string) => void;
  metodo: string;
  setMetodo: (v: string) => void;
  error: string;
  guardando: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="bg-surface-soft border border-line rounded-[14px] px-4 py-[0.9rem] flex flex-wrap gap-2.5 items-end max-w-[560px]">
      <div className="flex flex-col gap-1">
        <label className="text-[0.75rem] text-ink-muted">Monto a abonar (saldo: Q{saldo.toFixed(2)})</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          max={saldo}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          className="px-[0.6rem] py-[0.4rem] rounded-[10px] border border-line bg-surface w-[130px] text-[0.88rem]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[0.75rem] text-ink-muted">Método</label>
        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="px-[0.6rem] py-[0.4rem] rounded-[10px] border border-line bg-surface text-[0.88rem]"
        >
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="TARJETA">Tarjeta</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => setMonto(saldo.toFixed(2))}
        className="px-[0.7rem] py-[0.4rem] rounded-[10px] border border-market bg-transparent text-[var(--accent2)] text-[0.78rem] cursor-pointer"
      >
        Abonar todo
      </button>
      <button
        type="button"
        onClick={onGuardar}
        disabled={guardando}
        className={`px-4 py-[0.45rem] rounded-[10px] border-none bg-market text-black text-[0.85rem] font-semibold ${guardando ? "cursor-default opacity-70" : "cursor-pointer"}`}
      >
        {guardando ? "Guardando…" : "Guardar pago"}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="px-[0.9rem] py-[0.45rem] rounded-[10px] border border-line bg-transparent text-ink-muted text-[0.85rem] cursor-pointer"
      >
        Cancelar
      </button>
      {error && (
        <div className="w-full text-danger text-[0.8rem]">{error}</div>
      )}
    </div>
  );
}

export default function DeudasPage() {
  const usuario = useStaffSession();
  const [tab, setTab] = useState<"deudas" | "limites" | "notificaciones">("deudas");
  const [vista, setVista] = useState<"acumulado" | "vencimiento">("acumulado");
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [lineas, setLineas] = useState<LineaForm[]>([{ id_producto: "", cantidad: "1" }]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [alertaBloqueo, setAlertaBloqueo] = useState("");
  const [cambiandoId, setCambiandoId] = useState<number | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Registrar pago parcial
  const [pagandoId, setPagandoId] = useState<number | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  // Búsqueda/autocompletar cliente en "Nueva deuda"
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);

  // Notificaciones automáticas de deuda (pestaña "Notificaciones")
  const [notifConfig, setNotifConfig] = useState<{ activo: boolean; intervalo_dias: number } | null>(null);
  const [notifIntervaloInput, setNotifIntervaloInput] = useState("7");
  const [notifGuardando, setNotifGuardando] = useState(false);
  const [notifEjecutando, setNotifEjecutando] = useState(false);
  const [notifMensaje, setNotifMensaje] = useState("");
  const [notifError, setNotifError] = useState("");

  // Creación de cliente nuevo inline (desde el form de deuda o desde la pestaña de límites)
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formCliente, setFormCliente] = useState(clienteFormVacio);
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Edición de límites (pestaña "Límites de deuda")
  const [limitesEditando, setLimitesEditando] = useState<Record<number, string>>({});
  const [guardandoLimiteId, setGuardandoLimiteId] = useState<number | null>(null);

  // Búsqueda/filtros y paginación de las tablas de la página
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

  async function cargarProductos() {
    const res = await fetch("/api/productos");
    const data = await res.json();
    setProductos((data.productos || []).filter((p: any) => p.estado_producto));
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
    // Si el servidor no tiene esta ruta (404 con HTML) o falla, el resto de la
    // página debe seguir funcionando: solo se avisa en la tarjeta de recordatorios.
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
    cargarProductos();
    cargarClientes();
    cargarNotifConfig();
  }, []);

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
        // Si falló, deja el input como estaba antes del intento.
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
      const res = await fetch("/api/configuracion/notificaciones-deuda/ejecutar-ahora", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNotifError(data.error || "No se pudo ejecutar la corrida");
      } else if (!data.activo) {
        setNotifError("El envío automático está desactivado — actívalo primero para poder enviar.");
      } else {
        setNotifMensaje(
          `Corrida terminada: ${data.enviados} enviado${data.enviados === 1 ? "" : "s"}` +
            (data.fallidos > 0 ? `, ${data.fallidos} fallido${data.fallidos === 1 ? "" : "s"}` : "") +
            (data.procesados === 0 ? " (nadie tenía un recordatorio pendiente en este momento)." : ".")
        );
      }
    } catch {
      setNotifError("Error de conexión");
    } finally {
      setNotifEjecutando(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [tab, vista, qDeudas, qLimites, soloBloqueados, filtroVencimiento, perPage]);

  // Muestra el mensaje de alerta cuando una deuda vinculada a un cliente
  // acaba de bloquearlo o desbloquearlo por deuda.
  function mostrarAlerta(alerta: Alerta | null) {
    if (!alerta) return;
    if (alerta.bloqueado) {
      setAlertaBloqueo(
        `⚠️ Este cliente alcanzó su límite de deuda (Q${alerta.limite_deuda?.toFixed(2)}). ` +
          `Deuda pendiente: Q${alerta.deuda_pendiente.toFixed(2)}. Ya no puede comprar ni hacer pedidos.`
      );
    } else if (alerta.cambioEstado) {
      setAlertaBloqueo("✓ El cliente volvió a estar por debajo de su límite y puede comprar de nuevo.");
    } else {
      setAlertaBloqueo("");
    }
    cargarClientes();
  }

  const clienteSeleccionado = clientes.find((c) => String(c.id_cliente) === form.id_cliente);

  function deudaPendienteDe(id_cliente: number): number {
    return deudas
      .filter((d) => d.id_cliente === id_cliente && d.estado_deuda === "PENDIENTE")
      .reduce((acc, d) => acc + Number(d.monto_total), 0);
  }

  const clientesFiltrados =
    busquedaCliente.trim() === ""
      ? []
      : clientes.filter((c) => c.nombre.toLowerCase().includes(busquedaCliente.trim().toLowerCase()));

  function seleccionarCliente(c: Cliente) {
    setForm((f) => ({ ...f, id_cliente: String(c.id_cliente) }));
    setBusquedaCliente(c.nombre);
    setSugerenciasAbiertas(false);
  }

  async function crearCliente(): Promise<Cliente | null> {
    if (!formCliente.nombre.trim()) {
      setError("El nombre del cliente nuevo es obligatorio");
      return null;
    }
    const limiteInicial =
      formCliente.limite_deuda === "" ? null : Number(formCliente.limite_deuda);
    if (limiteInicial !== null && (!Number.isFinite(limiteInicial) || limiteInicial < 0)) {
      setError("El límite de deuda debe ser un número mayor o igual a 0");
      return null;
    }
    const deudaInicial =
      formCliente.deuda_inicial === "" ? null : Number(formCliente.deuda_inicial);
    if (deudaInicial !== null && (!Number.isFinite(deudaInicial) || deudaInicial <= 0)) {
      setError("La deuda inicial debe ser un número mayor a 0");
      return null;
    }

    setGuardandoCliente(true);
    setError("");
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: formCliente.nombre,
        telefono: formCliente.telefono,
        correo: formCliente.correo,
        tipo_cliente: formCliente.tipo_cliente,
        limite_deuda: limiteInicial,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear el cliente.");
      setGuardandoCliente(false);
      return null;
    }
    const data = await res.json();
    const nuevo: Cliente = data.cliente;

    // Si se indicó una deuda inicial (ej. un cliente que ya venía debiendo),
    // se registra de una vez como una deuda "de arrastre" sin productos. Como
    // el cliente ya tiene su límite recién asignado, esto puede bloquearlo de
    // inmediato si la deuda inicial ya lo supera.
    if (deudaInicial !== null) {
      const resDeuda = await fetch("/api/deudas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_deudor: nuevo.nombre,
          telefono_deudor: nuevo.telefono,
          fecha_inicio: new Date().toISOString().slice(0, 10),
          id_cliente: nuevo.id_cliente,
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
          `Cliente creado, pero no se pudo registrar la deuda inicial: ${
            dataErr.error || "error desconocido"
          }`
        );
      }
    }

    setClientes((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setLimitesEditando((prev) => ({ ...prev, [nuevo.id_cliente]: nuevo.limite_deuda ?? "" }));
    setCreandoCliente(false);
    setFormCliente(clienteFormVacio);
    setGuardandoCliente(false);
    return nuevo;
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

  // Agrupa las deudas por cliente (o por nombre_deudor para las viejas que no
  // están vinculadas a un cliente real) — usado en la vista "Acumulado". Se
  // recalcula solo cuando cambia la lista de deudas.
  const agruparPorCliente = useCallback(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        telefono: string | null;
        id_cliente: number | null;
        cliente_puede_comprar: boolean | null;
        limite_deuda: number | null;
        totalPendiente: number;
        deudas: Deuda[];
      }
    >();
    for (const d of deudas) {
      const key = d.id_cliente !== null ? `c${d.id_cliente}` : `n${d.nombre_deudor}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: d.nombre_deudor,
          telefono: d.telefono_deudor,
          id_cliente: d.id_cliente,
          cliente_puede_comprar: d.cliente_puede_comprar,
          limite_deuda: d.limite_deuda ? Number(d.limite_deuda) : null,
          totalPendiente: 0,
          deudas: [],
        });
      }
      const g = map.get(key)!;
      g.deudas.push(d);
      if (d.estado_deuda === "PENDIENTE") g.totalPendiente += Number(d.monto_total);
    }
    return Array.from(map.values()).sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [deudas]);

  const deudasPorVencer = useCallback((): Deuda[] => {
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

  // Lista "Acumulado por cliente" filtrada por búsqueda y por bloqueo, y paginada.
  const gruposFiltrados = useMemo(() => {
    return agruparPorCliente().filter((g) => {
      if (soloBloqueados && g.cliente_puede_comprar !== false) return false;
      return matchesQuery(qDeudas, g.label, g.telefono);
    });
  }, [agruparPorCliente, qDeudas, soloBloqueados]);
  const gruposPage = useMemo(
    () => paginar(gruposFiltrados, page, perPage),
    [gruposFiltrados, page, perPage]
  );

  // Lista "Próximas a vencer" filtrada por búsqueda, bloqueo y vencimiento, y paginada.
  const vencimientoFiltrado = useMemo(() => {
    return deudasPorVencer().filter((d) => {
      if (soloBloqueados && d.cliente_puede_comprar !== false) return false;
      if (!cumpleFiltroVencimiento(d.fecha_limite_pago, filtroVencimiento)) return false;
      return matchesQuery(qDeudas, d.nombre_deudor, d.telefono_deudor);
    });
  }, [deudasPorVencer, qDeudas, soloBloqueados, filtroVencimiento]);
  const vencimientoPage = useMemo(
    () => paginar(vencimientoFiltrado, page, perPage),
    [vencimientoFiltrado, page, perPage]
  );

  // Lista de clientes (pestaña "Límites de deuda") filtrada por búsqueda y bloqueo, y paginada.
  const clientesFiltradosLimites = useMemo(() => {
    return clientes.filter((c) => {
      if (soloBloqueados && c.estado_cliente) return false;
      return matchesQuery(qLimites, c.nombre, c.telefono, c.correo);
    });
  }, [clientes, qLimites, soloBloqueados]);
  const clientesPage = useMemo(
    () => paginar(clientesFiltradosLimites, page, perPage),
    [clientesFiltradosLimites, page, perPage]
  );

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando…</p>;
  }

  if (usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={usuario} title="Deudas" subtitle="">
        <p className="text-ink-muted">No tienes permiso para ver esta página.</p>
      </StaffShell>
    );
  }

  function agregarLinea() {
    setLineas([...lineas, { id_producto: "", cantidad: "1" }]);
  }

  function quitarLinea(idx: number) {
    setLineas(lineas.filter((_, i) => i !== idx));
  }

  function actualizarLinea(idx: number, campo: keyof LineaForm, valor: string) {
    setLineas(lineas.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function totalPreview(): number {
    return lineas.reduce((acc, l) => {
      const prod = productos.find((p) => String(p.id_producto) === l.id_producto);
      const cantidad = Number(l.cantidad) || 0;
      if (!prod) return acc;
      return acc + Number(prod.precio_unitario) * cantidad;
    }, 0);
  }

  function cerrarFormularioDeuda() {
    setCreando(false);
    setForm(formVacio);
    setBusquedaCliente("");
    setLineas([{ id_producto: "", cantidad: "1" }]);
  }

  async function crearDeuda() {
    setError("");
    setAlertaBloqueo("");

    if (!clienteSeleccionado) {
      setError("Selecciona (o crea) el cliente al que se le asigna la deuda.");
      return;
    }

    const productosPayload = lineas
      .filter((l) => l.id_producto && Number(l.cantidad) > 0)
      .map((l) => ({ id_producto: Number(l.id_producto), cantidad: Number(l.cantidad) }));

    const res = await fetch("/api/deudas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_deudor: clienteSeleccionado.nombre,
        telefono_deudor: clienteSeleccionado.telefono,
        fecha_inicio: form.fecha_inicio,
        fecha_limite_pago: form.fecha_limite_pago || null,
        id_cliente: clienteSeleccionado.id_cliente,
        productos: productosPayload,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setMensaje("Deuda creada.");
      cerrarFormularioDeuda();
      mostrarAlerta(data.alerta);
      cargarDeudas();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al crear la deuda.");
    }
  }

  // botonCambioEstado — DEV-81
  async function cambiarEstado(id_deuda: number) {
    setCambiandoId(id_deuda);
    setAlertaBloqueo("");
    const res = await fetch(`/api/deudas/${id_deuda}`, { method: "PATCH" });
    if (res.ok) {
      const data = await res.json();
      mostrarAlerta(data.alerta);
      cargarDeudas();
    } else {
      setError("No se pudo cambiar el estado de la deuda.");
    }
    setCambiandoId(null);
  }

  function abrirPago(id_deuda: number) {
    setPagandoId(id_deuda);
    setMontoPago("");
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
      setErrorPago("Ingresá un monto válido, mayor a 0.");
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


  function formularioClienteNuevo(onCreado: (nuevo: Cliente) => void) {
    return (
      <div className="p-3 border border-dashed border-line rounded-[14px] my-2">
        <div className="flex gap-2 mb-2">
          <input
            className={`${cls.input} w-full`}
            placeholder="Nombre *"
            value={formCliente.nombre}
            onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
          />
          <input
            className={`${cls.input} w-full`}
            placeholder="Teléfono"
            value={formCliente.telefono}
            onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
          />
        </div>
        <div className="flex gap-2 mb-2">
          <input
            className={`${cls.input} w-full`}
            placeholder="Correo (opcional)"
            value={formCliente.correo}
            onChange={(e) => setFormCliente({ ...formCliente, correo: e.target.value })}
          />
          <select
            className={`${cls.input} w-full`}
            value={formCliente.tipo_cliente}
            onChange={(e) => setFormCliente({ ...formCliente, tipo_cliente: e.target.value })}
          >
            <option value="MINORISTA">Minorista</option>
            <option value="MAYORISTA">Mayorista</option>
          </select>
        </div>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <label className="block mb-1 text-[0.8rem]">
              Límite de deuda (opcional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${cls.input} w-full`}
              placeholder="Sin límite"
              value={formCliente.limite_deuda}
              onChange={(e) => setFormCliente({ ...formCliente, limite_deuda: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 text-[0.8rem]">
              Deuda que ya tenía (opcional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${cls.input} w-full`}
              placeholder="Q0.00"
              value={formCliente.deuda_inicial}
              onChange={(e) => setFormCliente({ ...formCliente, deuda_inicial: e.target.value })}
            />
          </div>
        </div>
        <p className="text-[0.75rem] text-ink-muted -mt-1 mb-2">
          Si ya te debía algo se registra de una vez como deuda pendiente — y si eso ya supera el
          límite que le pongas, queda bloqueado desde ya.
        </p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const nuevo = await crearCliente();
              if (nuevo) onCreado(nuevo);
            }}
            disabled={guardandoCliente}
            className={`px-[0.8rem] py-[0.3rem] rounded-[14px] bg-success text-white border-none text-[0.85rem] ${guardandoCliente ? "cursor-default" : "cursor-pointer"}`}
          >
            {guardandoCliente ? "Creando…" : "Crear cliente"}
          </button>
          <button
            onClick={() => {
              setCreandoCliente(false);
              setFormCliente(clienteFormVacio);
            }}
            className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none cursor-pointer text-[0.85rem]"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <StaffShell
      usuario={usuario}
      title="Deudas"
      subtitle="Registra y controla las deudas pendientes"
    >
      {mensaje && (
        <p className="text-success mb-4 font-semibold">{mensaje}</p>
      )}
      {error && (
        <p className="text-danger mb-4 font-semibold">{error}</p>
      )}
      {alertaBloqueo && (
        <p className={`text-white px-4 py-[0.6rem] rounded-[14px] mb-4 font-semibold ${alertaBloqueo.startsWith("⚠️") ? "bg-danger" : "bg-success"}`}>
          {alertaBloqueo}
        </p>
      )}

      <div className="flex gap-1 mb-6 border-b border-line">
        {(
          [
            { id: "deudas", label: "Deudas" },
            { id: "limites", label: "Límites de deuda" },
            { id: "notificaciones", label: "Notificaciones" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setError("");
              setMensaje("");
            }}
            className={`px-[1.1rem] py-[0.6rem] border-none bg-transparent cursor-pointer font-semibold border-b-2 ${
              tab === t.id ? "text-ink border-success" : "text-ink-muted border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deudas" && (
        <>
          {!creando && (
            <button
              onClick={() => {
                setCreando(true);
                setMensaje("");
                setError("");
              }}
              className="mb-6 px-[1.2rem] py-2 rounded-[14px] bg-success text-white border-none cursor-pointer font-semibold"
            >
              + Nueva deuda
            </button>
          )}

          {creando && (
            <div className="mb-6 p-4 border border-line rounded-[14px] max-w-[600px]">
              <h3 className="mb-4">Nueva deuda</h3>

              <div className="mb-3">
                <label className="block mb-1 text-[0.85rem]">
                  Cliente *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1 isolate">
                    <input
                      className={`${cls.input} w-full`}
                      placeholder="Escribe el nombre para buscar…"
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        setForm((f) => ({ ...f, id_cliente: "" }));
                        setSugerenciasAbiertas(true);
                      }}
                      onFocus={() => setSugerenciasAbiertas(true)}
                      onBlur={() => setTimeout(() => setSugerenciasAbiertas(false), 150)}
                    />
                    {sugerenciasAbiertas && busquedaCliente.trim() !== "" && (
                      <div className="absolute top-[calc(100%+2px)] left-0 right-0 bg-surface border border-line rounded-[14px] z-[100] max-h-[200px] overflow-y-auto shadow-[0_8px_20px_rgba(80,60,20,0.22)]">
                        {clientesFiltrados.length === 0 && (
                          <div className="px-[0.7rem] py-2 text-[0.85rem] text-ink-muted bg-surface">
                            Sin resultados — probá &quot;+ Cliente nuevo&quot;.
                          </div>
                        )}
                        {clientesFiltrados.slice(0, 8).map((c) => (
                          <div
                            key={c.id_cliente}
                            onMouseDown={(e) => {
                              // Sin esto, el navegador le quita el foco al
                              // input ANTES de que corra este click
                              // (mousedown ocurre antes del blur), lo que
                              // dispara un blur real de más que compite con
                              // el cierre del dropdown que ya hace
                              // seleccionarCliente.
                              e.preventDefault();
                              seleccionarCliente(c);
                            }}
                            className="px-[0.7rem] py-[0.45rem] cursor-pointer text-[0.85rem] border-b border-line bg-surface"
                          >
                            {c.nombre} {c.estado_cliente ? "" : "(bloqueado)"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setCreandoCliente((v) => !v)}
                    className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none cursor-pointer text-[0.8rem] whitespace-nowrap"
                  >
                    + Cliente nuevo
                  </button>
                </div>
                <p className="text-[0.78rem] text-ink-muted mt-1">
                  Toda deuda queda asociada a un cliente registrado; si supera su límite, se le
                  bloquean compras y pedidos.
                </p>

                {creandoCliente &&
                  formularioClienteNuevo((nuevo) => {
                    setForm((f) => ({ ...f, id_cliente: String(nuevo.id_cliente) }));
                    setBusquedaCliente(nuevo.nombre);
                    setCreandoCliente(false);
                  })}

                {clienteSeleccionado && (
                  <p className="text-[0.82rem] mt-1">
                    {clienteSeleccionado.telefono && <>Tel: {clienteSeleccionado.telefono} · </>}
                    Deuda pendiente actual: Q{deudaPendienteDe(clienteSeleccionado.id_cliente).toFixed(2)}
                    {clienteSeleccionado.limite_deuda && (
                      <> / límite Q{Number(clienteSeleccionado.limite_deuda).toFixed(2)}</>
                    )}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="block mb-1 text-[0.85rem]">
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    className={`${cls.input} w-full`}
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-1 text-[0.85rem]">
                    Fecha límite de pago (opcional)
                  </label>
                  <input
                    type="date"
                    className={`${cls.input} w-full`}
                    value={form.fecha_limite_pago}
                    onChange={(e) => setForm({ ...form, fecha_limite_pago: e.target.value })}
                  />
                </div>
              </div>

              <label className="block mb-1 text-[0.85rem]">
                Productos *
              </label>
              {lineas.map((linea, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    className={`${cls.input} w-full`}
                    value={linea.id_producto}
                    onChange={(e) => actualizarLinea(idx, "id_producto", e.target.value)}
                  >
                    <option value="">Seleccionar un producto…</option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre_producto} (Q{Number(p.precio_unitario).toFixed(2)}/{p.unidad_medida})
                      </option>
                    ))}
                  </select>
                  <CantidadInput
                    ariaLabel="Cantidad"
                    containerStyle={{ flex: "0 0 128px" }}
                    style={inputStyle}
                    value={linea.cantidad}
                    onChange={(cantidad) => actualizarLinea(idx, "cantidad", cantidad)}
                  />
                  {lineas.length > 1 && (
                    <button
                      onClick={() => quitarLinea(idx)}
                      className="px-[0.6rem] py-0 rounded-[14px] bg-line border-none cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={agregarLinea}
                className="mt-1 mb-4 px-[0.8rem] py-[0.3rem] rounded-[14px] bg-transparent border border-dashed border-line cursor-pointer text-[0.85rem]"
              >
                + Agregar producto
              </button>

              <p className="font-bold mb-4">
                Total: Q{totalPreview().toFixed(2)}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={crearDeuda}
                  className="px-4 py-[0.4rem] rounded-[14px] bg-success text-white border-none cursor-pointer"
                >
                  Guardar deuda
                </button>
                <button
                  onClick={cerrarFormularioDeuda}
                  className="px-4 py-[0.4rem] rounded-[14px] bg-line border-none cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-1.5 mb-4">
            <button className={tabPillClass(vista === "acumulado")} onClick={() => setVista("acumulado")}>
              Acumulado por cliente
            </button>
            <button className={tabPillClass(vista === "vencimiento")} onClick={() => setVista("vencimiento")}>
              Próximas a vencer
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="search"
              value={qDeudas}
              onChange={(e) => setQDeudas(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              aria-label="Buscar en deudas"
              className={`${cls.input} flex-[1_1_220px] min-w-[200px] w-auto`}
            />
            {vista === "vencimiento" && (
              <select
                value={filtroVencimiento}
                onChange={(e) => setFiltroVencimiento(e.target.value as FiltroVencimiento)}
                aria-label="Filtrar por vencimiento"
                className={`${cls.input} w-auto min-w-[190px]`}
              >
                <option value="todas">Todos los vencimientos</option>
                <option value="vencidas">Vencidas</option>
                <option value="proximas">Vencen en 3 días o menos</option>
                <option value="sin_fecha">Sin fecha límite</option>
              </select>
            )}
            <label className="flex items-center gap-[0.4rem] text-[0.85rem] text-ink-muted cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={soloBloqueados}
                onChange={(e) => setSoloBloqueados(e.target.checked)}
              />
              Solo clientes bloqueados
            </label>
          </div>

          {vista === "acumulado" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.9rem]">
                <thead>
                  <tr className="border-b-2 border-line text-left">
                    <th className={cls.td}>Persona</th>
                    <th className={cls.td}>Estado</th>
                    <th className={cls.td}>Deuda pendiente acumulada</th>
                    <th className={cls.td}></th>
                  </tr>
                </thead>
                <tbody>
                  {gruposPage.slice.map((g) => (
                    <Fragment key={g.key}>
                      <tr className="border-b border-line">
                        <td className={cls.td}>
                          {g.label}
                          {g.telefono && (
                            <div className="text-ink-muted text-[0.78rem]">{g.telefono}</div>
                          )}
                        </td>
                        <td className={cls.td}>
                          {g.id_cliente === null ? (
                            <span className="text-ink-muted">Sin vincular</span>
                          ) : (
                            <span className={`font-semibold ${g.cliente_puede_comprar ? "text-success" : "text-danger"}`}>
                              {g.cliente_puede_comprar ? "Activo" : "Bloqueado"}
                            </span>
                          )}
                        </td>
                        <td className={`${cls.td} font-semibold`}>
                          Q{g.totalPendiente.toFixed(2)}
                          {g.limite_deuda !== null && (
                            <span className="text-ink-muted font-normal">
                              {" "}
                              / límite Q{g.limite_deuda.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className={cls.td}>
                          <button
                            onClick={() => toggleExpandido(g.key)}
                            className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none cursor-pointer text-[0.8rem]"
                          >
                            {expandidos.has(g.key) ? "Ocultar detalle" : "Detalle"}
                          </button>
                        </td>
                      </tr>
                      {expandidos.has(g.key) && (
                        <tr key={`${g.key}-detalle`}>
                          <td colSpan={4} className="px-3 pt-0 pb-4">
                            <table className="w-full border-collapse text-[0.82rem]">
                              <thead>
                                <tr className="text-ink-muted text-left">
                                  <th className={cls.tdSm}>Fecha inicio</th>
                                  <th className={cls.tdSm}>Fecha límite</th>
                                  <th className={cls.tdSm}>Productos</th>
                                  <th className={cls.tdSm}>Monto</th>
                                  <th className={cls.tdSm}>Saldo / cubierto</th>
                                  <th className={cls.tdSm}>Estado</th>
                                  <th className={cls.tdSm}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.deudas.map((d) => (
                                  <Fragment key={d.id_deuda}>
                                    <tr className="border-t border-line">
                                    <td className={cls.tdSm}>
                                      {new Date(d.fecha_inicio).toLocaleDateString("es-GT")}
                                    </td>
                                    <td className={cls.tdSm}>
                                      {d.fecha_limite_pago
                                        ? new Date(d.fecha_limite_pago).toLocaleDateString("es-GT")
                                        : "—"}
                                    </td>
                                    <td className={`${cls.tdSm} text-ink-muted`}>
                                      {d.productos.length > 0
                                        ? d.productos.map((p) => `${p.nombre_producto} x${p.cantidad}`).join(", ")
                                        : "—"}
                                    </td>
                                    <td className={`${cls.tdSm} font-semibold`}>
                                      Q{Number(d.monto_total).toFixed(2)}
                                    </td>
                                    <td className={`${cls.tdSm} min-w-[140px]`}>
                                      <SaldoCubierto d={d} />
                                    </td>
                                    <td className={cls.tdSm}>
                                      <span className={`font-semibold ${d.estado_deuda === "PAGADA" ? "text-success" : "text-danger"}`}>
                                        {d.estado_deuda === "PAGADA" ? "Pagada" : "Pendiente"}
                                      </span>
                                    </td>
                                    <td className={cls.tdSm}>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {d.estado_deuda === "PENDIENTE" && (
                                          <button
                                            onClick={() => abrirPago(d.id_deuda)}
                                            className="px-[0.6rem] py-1 rounded-[14px] bg-market text-black border-none cursor-pointer text-[0.75rem]"
                                          >
                                            Registrar pago
                                          </button>
                                        )}
                                        <button
                                          onClick={() => cambiarEstado(d.id_deuda)}
                                          disabled={cambiandoId === d.id_deuda}
                                          className={`px-[0.6rem] py-1 rounded-[14px] text-white border-none text-[0.75rem] ${d.estado_deuda === "PAGADA" ? "bg-danger" : "bg-success"} ${cambiandoId === d.id_deuda ? "cursor-default opacity-60" : "cursor-pointer"}`}
                                        >
                                          {cambiandoId === d.id_deuda
                                            ? "…"
                                            : d.estado_deuda === "PAGADA"
                                            ? "Marcar pendiente"
                                            : "Marcar pagada"}
                                        </button>
                                      </div>
                                    </td>
                                    </tr>
                                    {pagandoId === d.id_deuda && (
                                      <tr>
                                        <td colSpan={7} className="pt-2 px-[0.4rem] pb-[0.9rem]">
                                          <FormPago
                                            saldo={Number(d.saldo_pendiente)}
                                            monto={montoPago}
                                            setMonto={setMontoPago}
                                            metodo={metodoPago}
                                            setMetodo={setMetodoPago}
                                            error={errorPago}
                                            guardando={guardandoPago}
                                            onGuardar={() => registrarPago(d.id_deuda)}
                                            onCancelar={cerrarPago}
                                          />
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {gruposPage.slice.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-ink-muted">
                        {qDeudas.trim() || soloBloqueados
                          ? "Ningún resultado para esa búsqueda o filtro."
                          : "No hay deudas registradas."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <PaginationBar
                total={gruposPage.total}
                page={gruposPage.paginaSegura}
                perPage={perPage}
                onPage={setPage}
                onPerPage={setPerPage}
                noun="clientes"
              />
            </div>
          )}

          {vista === "vencimiento" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.9rem]">
                <thead>
                  <tr className="border-b-2 border-line text-left">
                    <th className={cls.td}>Persona</th>
                    <th className={cls.td}>Monto</th>
                    <th className={cls.td}>Saldo / cubierto</th>
                    <th className={cls.td}>Fecha límite</th>
                    <th className={cls.td}>Vencimiento</th>
                    <th className={cls.td}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vencimientoPage.slice.map((d) => {
                    const rest = diasRestantes(d.fecha_limite_pago);
                    return (
                      <Fragment key={d.id_deuda}>
                        <tr className="border-b border-line">
                          <td className={cls.td}>
                            {d.nombre_deudor}
                            {d.id_cliente !== null && d.cliente_puede_comprar === false && (
                              <span className={cls.badgeBloqueado}>bloqueado</span>
                            )}
                          </td>
                          <td className={`${cls.td} font-semibold`}>
                            Q{Number(d.monto_total).toFixed(2)}
                          </td>
                          <td className={`${cls.td} min-w-[140px]`}>
                            <SaldoCubierto d={d} />
                          </td>
                          <td className={`${cls.td} text-ink-muted`}>
                            {d.fecha_limite_pago
                              ? new Date(d.fecha_limite_pago).toLocaleDateString("es-GT")
                              : "—"}
                          </td>
                          <td className={`${cls.td} font-semibold ${rest.cls}`}>
                            {rest.texto}
                          </td>
                          <td className={cls.td}>
                            <div className="flex gap-1.5 flex-wrap">
                              <button
                                onClick={() => abrirPago(d.id_deuda)}
                                className="px-[0.8rem] py-[0.3rem] rounded-[14px] bg-market text-white border-none cursor-pointer text-[0.8rem]"
                              >
                                Registrar pago
                              </button>
                              <button
                                onClick={() => cambiarEstado(d.id_deuda)}
                                disabled={cambiandoId === d.id_deuda}
                                className={`px-[0.8rem] py-[0.3rem] rounded-[14px] bg-success text-white border-none text-[0.8rem] ${cambiandoId === d.id_deuda ? "cursor-default opacity-60" : "cursor-pointer"}`}
                              >
                                {cambiandoId === d.id_deuda ? "Guardando…" : "Marcar pagada"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {pagandoId === d.id_deuda && (
                          <tr>
                            <td colSpan={6} className="pt-2 px-3 pb-4">
                              <FormPago
                                saldo={Number(d.saldo_pendiente)}
                                monto={montoPago}
                                setMonto={setMontoPago}
                                metodo={metodoPago}
                                setMetodo={setMetodoPago}
                                error={errorPago}
                                guardando={guardandoPago}
                                onGuardar={() => registrarPago(d.id_deuda)}
                                onCancelar={cerrarPago}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {vencimientoPage.slice.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-ink-muted">
                        No hay deudas pendientes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <PaginationBar
                total={vencimientoPage.total}
                page={vencimientoPage.paginaSegura}
                perPage={perPage}
                onPage={setPage}
                onPerPage={setPerPage}
                noun="deudas"
              />
            </div>
          )}
        </>
      )}

      {tab === "limites" && (
        <>
          <p className="text-ink-muted mb-4 max-w-[640px]">
            Define el límite de deuda de cada cliente. Al llegar (o superar) ese monto en deudas
            pendientes, el cliente queda bloqueado automáticamente para comprar o hacer pedidos —
            se desbloquea solo cuando su deuda pendiente vuelve a bajar del límite.
          </p>

          {!creandoCliente && (
            <button
              onClick={() => setCreandoCliente(true)}
              className="mb-4 px-4 py-[0.4rem] rounded-[14px] bg-success text-white border-none cursor-pointer font-semibold text-[0.85rem]"
            >
              + Nuevo cliente
            </button>
          )}
          {creandoCliente && (
            <div className="max-w-[560px]">
              {formularioClienteNuevo(() => setCreandoCliente(false))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="search"
              value={qLimites}
              onChange={(e) => setQLimites(e.target.value)}
              placeholder="Buscar cliente por nombre, teléfono o correo…"
              aria-label="Buscar clientes"
              className={`${cls.input} flex-[1_1_260px] min-w-[220px] w-auto`}
            />
            <label className="flex items-center gap-[0.4rem] text-[0.85rem] text-ink-muted cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={soloBloqueados}
                onChange={(e) => setSoloBloqueados(e.target.checked)}
              />
              Solo clientes bloqueados
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.9rem]">
              <thead>
                <tr className="border-b-2 border-line text-left">
                  <th className={cls.td}>Cliente</th>
                  <th className={cls.td}>Estado</th>
                  <th className={cls.td}>Deuda pendiente</th>
                  <th className={cls.td}>Límite de deuda (Q)</th>
                  <th className={cls.td}></th>
                </tr>
              </thead>
              <tbody>
                {clientesPage.slice.map((c) => (
                  <tr key={c.id_cliente} className="border-b border-line">
                    <td className={cls.td}>
                      {c.nombre}
                      {c.telefono && (
                        <div className="text-ink-muted text-[0.78rem]">{c.telefono}</div>
                      )}
                    </td>
                    <td className={cls.td}>
                      <span className={`font-semibold ${c.estado_cliente ? "text-success" : "text-danger"}`}>
                        {c.estado_cliente ? "Activo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className={cls.td}>Q{deudaPendienteDe(c.id_cliente).toFixed(2)}</td>
                    <td className={cls.td}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Sin límite"
                        className={`${cls.input} w-[130px]`}
                        value={limitesEditando[c.id_cliente] ?? ""}
                        onChange={(e) =>
                          setLimitesEditando((prev) => ({ ...prev, [c.id_cliente]: e.target.value }))
                        }
                      />
                    </td>
                    <td className={cls.td}>
                      <button
                        onClick={() => guardarLimite(c.id_cliente)}
                        disabled={guardandoLimiteId === c.id_cliente}
                        className={`px-[0.8rem] py-[0.3rem] rounded-[14px] bg-line border-none text-[0.8rem] ${guardandoLimiteId === c.id_cliente ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {guardandoLimiteId === c.id_cliente ? "Guardando…" : "Guardar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {clientesPage.slice.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-ink-muted">
                      {qLimites.trim() || soloBloqueados
                        ? "Ningún resultado para esa búsqueda o filtro."
                        : "No hay clientes registrados."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationBar
              total={clientesPage.total}
              page={clientesPage.paginaSegura}
              perPage={perPage}
              onPage={setPage}
              onPerPage={setPerPage}
              noun="clientes"
            />
          </div>
        </>
      )}

      {tab === "notificaciones" && (
        <div className="max-w-[560px]">
          <h3 className="mb-[0.4rem]">Recordatorios automáticos de deuda</h3>
          <p className="text-ink-muted text-[0.88rem] leading-[1.6] mb-5">
            Cuando está activo, el sistema revisa cada hora si algún cliente con deuda pendiente y
            correo registrado no ha recibido un recordatorio en los últimos días que configures acá,
            y le manda uno automáticamente por correo.
          </p>

          {notifConfig === null ? (
            <p className="text-ink-muted">Cargando…</p>
          ) : (
            <div className="border border-line rounded-[14px] p-5 flex flex-col gap-[1.1rem]">
              <label className="flex items-center gap-[0.6rem] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifConfig.activo}
                  disabled={notifGuardando}
                  onChange={(e) => guardarNotifConfig({ activo: e.target.checked })}
                />
                <span className="font-semibold">
                  Envío automático {notifConfig.activo ? "activado" : "desactivado"}
                </span>
              </label>

              <div>
                <label className="block font-semibold mb-[0.4rem] text-[0.88rem]">
                  Recordar cada (días)
                </label>
                <div className="flex gap-[0.6rem] items-center">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={notifIntervaloInput}
                    onChange={(e) => setNotifIntervaloInput(e.target.value)}
                    className="w-[100px] px-[0.7rem] py-2 rounded-[10px] border border-line"
                  />
                  <button
                    type="button"
                    disabled={
                      notifGuardando ||
                      !notifIntervaloInput ||
                      Number(notifIntervaloInput) === notifConfig.intervalo_dias
                    }
                    onClick={() => guardarNotifConfig({ intervalo_dias: Number(notifIntervaloInput) })}
                    className="px-4 py-2 rounded-[10px] border border-line bg-surface-soft cursor-pointer font-semibold"
                  >
                    {notifGuardando ? "Guardando…" : "Guardar"}
                  </button>
                </div>
                <p className="text-ink-muted text-[0.78rem] mt-[0.4rem]">
                  A cada cliente con deuda pendiente se le vuelve a recordar cuando pasan al menos
                  este número de días desde su último recordatorio (o desde nunca, si es la primera vez).
                </p>
              </div>

              <div className="border-t border-line pt-4">
                <button
                  type="button"
                  onClick={ejecutarNotifAhora}
                  disabled={notifEjecutando || !notifConfig.activo}
                  title={!notifConfig.activo ? "Activa el envío automático primero" : undefined}
                  className={`px-[1.2rem] py-[0.55rem] rounded-[14px] bg-success text-white border-none font-semibold ${notifConfig.activo ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-60"}`}
                >
                  {notifEjecutando ? "Enviando…" : "Enviar ahora"}
                </button>
                <p className="text-ink-muted text-[0.78rem] mt-2">
                  Fuerza una corrida inmediata (sin esperar a la revisión automática). Solo les
                  llegará a quienes ya les tocaba según el intervalo de arriba.
                </p>
              </div>

              {notifMensaje && (
                <p className="text-success font-semibold m-0">{notifMensaje}</p>
              )}
              {notifError && (
                <p className="text-danger font-semibold m-0">{notifError}</p>
              )}
            </div>
          )}
        </div>
      )}

    </StaffShell>
  );
}