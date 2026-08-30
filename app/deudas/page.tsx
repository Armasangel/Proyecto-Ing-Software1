"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";

type ProductoDeuda = {
  id_producto: number;
  nombre_producto: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
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

const inputStyle: React.CSSProperties = {
  padding: "0.3rem 0.6rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  width: "100%",
  background: "var(--surface)",
  color: "var(--text)",
};

const badgeStyle = (bg: string): React.CSSProperties => ({
  marginLeft: 6,
  fontSize: "0.72rem",
  color: "#fff",
  background: bg,
  padding: "1px 6px",
  borderRadius: 4,
});

function diasRestantes(fecha: string | null): { texto: string; color: string } {
  if (!fecha) return { texto: "Sin fecha límite", color: "var(--muted)" };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) return { texto: `Vencida hace ${Math.abs(dias)} día(s)`, color: "#e63946" };
  if (dias === 0) return { texto: "Vence hoy", color: "#e63946" };
  if (dias <= 3) return { texto: `Vence en ${dias} día(s)`, color: "#e08e0b" };
  return { texto: `Vence en ${dias} día(s)`, color: "var(--muted)" };
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

function matchesQuery(query: string, ...campos: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return campos.some((c) => String(c ?? "").toLowerCase().includes(q));
}

type PageSize = 10 | 25 | 50;
const PAGE_SIZES: PageSize[] = [10, 25, 50];

function paginar<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage) || 1);
  const paginaSegura = Math.min(Math.max(1, page), totalPaginas);
  const inicio = (paginaSegura - 1) * perPage;
  return {
    slice: items.slice(inicio, inicio + perPage),
    total,
    totalPaginas,
    paginaSegura,
  };
}

function PaginationBar({
  total,
  page,
  perPage,
  onPage,
  onPerPage,
  noun,
}: {
  total: number;
  page: number;
  perPage: PageSize;
  onPage: (p: number) => void;
  onPerPage: (n: PageSize) => void;
  noun: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / perPage) || 1);
  const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
  const hasta = Math.min(page * perPage, total);
  const sinAnterior = page <= 1;
  const sinSiguiente = page >= totalPaginas || total === 0;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.75rem",
        borderTop: "1px solid var(--border)",
      }}
      role="navigation"
      aria-label="Paginación"
    >
      <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
        {total === 0 ? `Sin ${noun}` : `Mostrando ${desde}–${hasta} de ${total} ${noun}`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--muted)", fontSize: "0.82rem" }}>
          Por página
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value) as PageSize)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.3rem 0.4rem",
              color: "var(--text)",
              fontSize: "0.82rem",
            }}
            aria-label="Resultados por página"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={sinAnterior}
          aria-label="Página anterior"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            borderRadius: 6,
            padding: "0.3rem 0.7rem",
            fontSize: "0.82rem",
            cursor: sinAnterior ? "not-allowed" : "pointer",
            opacity: sinAnterior ? 0.45 : 1,
          }}
        >
          Anterior
        </button>
        <span style={{ fontSize: "0.82rem", color: "var(--muted)", minWidth: 60, textAlign: "center" }}>
          {page} / {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={sinSiguiente}
          aria-label="Página siguiente"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            borderRadius: 6,
            padding: "0.3rem 0.7rem",
            fontSize: "0.82rem",
            cursor: sinSiguiente ? "not-allowed" : "pointer",
            opacity: sinSiguiente ? 0.45 : 1,
          }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default function DeudasPage() {
  const usuario = useStaffSession();
  const [tab, setTab] = useState<"deudas" | "limites">("deudas");
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

  // Búsqueda, filtrado y paginación de las listas (pestañas "Deudas" y "Límites")
  const [qDeudas, setQDeudas] = useState("");
  const [qLimites, setQLimites] = useState("");
  const [soloBloqueados, setSoloBloqueados] = useState(false);
  const [filtroVencimiento, setFiltroVencimiento] = useState<FiltroVencimiento>("todas");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

  // Búsqueda/autocompletar cliente en "Nueva deuda"
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);

  // Creación de cliente nuevo inline (desde el form de deuda o desde la pestaña de límites)
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formCliente, setFormCliente] = useState(clienteFormVacio);
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Edición de límites (pestaña "Límites de deuda")
  const [limitesEditando, setLimitesEditando] = useState<Record<number, string>>({});
  const [guardandoLimiteId, setGuardandoLimiteId] = useState<number | null>(null);

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

  useEffect(() => {
    cargarDeudas();
    cargarProductos();
    cargarClientes();
  }, []);

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
    return <p style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</p>;
  }

  if (usuario.tipo_usuario !== "DUENO") {
    return (
      <StaffShell usuario={usuario} title="Deudas" subtitle="">
        <p style={{ color: "var(--muted)" }}>No tienes permiso para ver esta página.</p>
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
      <div
        style={{
          padding: "0.75rem",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          marginTop: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            style={inputStyle}
            placeholder="Nombre *"
            value={formCliente.nombre}
            onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
          />
          <input
            style={inputStyle}
            placeholder="Teléfono"
            value={formCliente.telefono}
            onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            style={inputStyle}
            placeholder="Correo (opcional)"
            value={formCliente.correo}
            onChange={(e) => setFormCliente({ ...formCliente, correo: e.target.value })}
          />
          <select
            style={inputStyle}
            value={formCliente.tipo_cliente}
            onChange={(e) => setFormCliente({ ...formCliente, tipo_cliente: e.target.value })}
          >
            <option value="MINORISTA">Minorista</option>
            <option value="MAYORISTA">Mayorista</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>
              Límite de deuda (opcional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              style={inputStyle}
              placeholder="Sin límite"
              value={formCliente.limite_deuda}
              onChange={(e) => setFormCliente({ ...formCliente, limite_deuda: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>
              Deuda que ya tenía (opcional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              style={inputStyle}
              placeholder="Q0.00"
              value={formCliente.deuda_inicial}
              onChange={(e) => setFormCliente({ ...formCliente, deuda_inicial: e.target.value })}
            />
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: -4, marginBottom: "0.5rem" }}>
          Si ya te debía algo se registra de una vez como deuda pendiente — y si eso ya supera el
          límite que le pongas, queda bloqueado desde ya.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              const nuevo = await crearCliente();
              if (nuevo) onCreado(nuevo);
            }}
            disabled={guardandoCliente}
            style={{
              padding: "0.3rem 0.8rem",
              borderRadius: 6,
              background: "#52b788",
              color: "#fff",
              border: "none",
              cursor: guardandoCliente ? "default" : "pointer",
              fontSize: "0.85rem",
            }}
          >
            {guardandoCliente ? "Creando…" : "Crear cliente"}
          </button>
          <button
            onClick={() => {
              setCreandoCliente(false);
              setFormCliente(clienteFormVacio);
            }}
            style={{
              padding: "0.3rem 0.8rem",
              borderRadius: 6,
              background: "var(--border)",
              border: "none",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const tabBtnStyle = (activo: boolean): React.CSSProperties => ({
    padding: "0.35rem 0.9rem",
    borderRadius: 999,
    border: activo ? "1px solid #52b788" : "1px solid var(--border)",
    background: activo ? "#52b788" : "transparent",
    color: activo ? "#fff" : "var(--text)",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 600,
  });

  return (
    <StaffShell
      usuario={usuario}
      title="Deudas"
      subtitle="Registra y controla las deudas pendientes"
    >
      {mensaje && (
        <p style={{ color: "#52b788", marginBottom: "1rem", fontWeight: 600 }}>{mensaje}</p>
      )}
      {error && (
        <p style={{ color: "#e63946", marginBottom: "1rem", fontWeight: 600 }}>{error}</p>
      )}
      {alertaBloqueo && (
        <p
          style={{
            color: "#fff",
            background: alertaBloqueo.startsWith("⚠️") ? "#e63946" : "#52b788",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            marginBottom: "1rem",
            fontWeight: 600,
          }}
        >
          {alertaBloqueo}
        </p>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", borderBottom: "1px solid var(--border)" }}>
        {(
          [
            { id: "deudas", label: "Deudas" },
            { id: "limites", label: "Límites de deuda" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setError("");
              setMensaje("");
            }}
            style={{
              padding: "0.6rem 1.1rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              color: tab === t.id ? "var(--text)" : "var(--muted)",
              borderBottom: tab === t.id ? "2px solid #52b788" : "2px solid transparent",
            }}
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
              style={{
                marginBottom: "1.5rem",
                padding: "0.5rem 1.2rem",
                borderRadius: 6,
                background: "#52b788",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Nueva deuda
            </button>
          )}

          {creando && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "1rem",
                border: "1px solid var(--border)",
                borderRadius: 8,
                maxWidth: 600,
              }}
            >
              <h3 style={{ marginBottom: "1rem" }}>Nueva deuda</h3>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                  Cliente *
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      style={inputStyle}
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
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          marginTop: 2,
                          zIndex: 20,
                          maxHeight: 200,
                          overflowY: "auto",
                          boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                        }}
                      >
                        {clientesFiltrados.length === 0 && (
                          <div style={{ padding: "0.5rem 0.7rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                            Sin resultados — prueba &quot;+ Cliente nuevo&quot;.
                          </div>
                        )}
                        {clientesFiltrados.slice(0, 8).map((c) => (
                          <div
                            key={c.id_cliente}
                            onMouseDown={() => seleccionarCliente(c)}
                            style={{
                              padding: "0.45rem 0.7rem",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            {c.nombre} {c.estado_cliente ? "" : "(bloqueado)"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setCreandoCliente((v) => !v)}
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: 6,
                      background: "var(--border)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Cliente nuevo
                  </button>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
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
                  <p style={{ fontSize: "0.82rem", marginTop: 4 }}>
                    {clienteSeleccionado.telefono && <>Tel: {clienteSeleccionado.telefono} · </>}
                    Deuda pendiente actual: Q{deudaPendienteDe(clienteSeleccionado.id_cliente).toFixed(2)}
                    {clienteSeleccionado.limite_deuda && (
                      <> / límite Q{Number(clienteSeleccionado.limite_deuda).toFixed(2)}</>
                    )}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                    Fecha límite de pago (opcional)
                  </label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.fecha_limite_pago}
                    onChange={(e) => setForm({ ...form, fecha_limite_pago: e.target.value })}
                  />
                </div>
              </div>

              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                Productos *
              </label>
              {lineas.map((linea, idx) => (
                <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select
                    style={inputStyle}
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
                  <input
                    type="number"
                    min={0.001}
                    step="1"
                    style={{ ...inputStyle, width: 100 }}
                    value={linea.cantidad}
                    onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)}
                  />
                  {lineas.length > 1 && (
                    <button
                      onClick={() => quitarLinea(idx)}
                      style={{
                        padding: "0 0.6rem",
                        borderRadius: 6,
                        background: "var(--border)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={agregarLinea}
                style={{
                  marginTop: "0.25rem",
                  marginBottom: "1rem",
                  padding: "0.3rem 0.8rem",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px dashed var(--border)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                + Agregar producto
              </button>

              <p style={{ fontWeight: 700, marginBottom: "1rem" }}>
                Total: Q{totalPreview().toFixed(2)}
              </p>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={crearDeuda}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 6,
                    background: "#52b788",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Guardar deuda
                </button>
                <button
                  onClick={cerrarFormularioDeuda}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 6,
                    background: "var(--border)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
            <button style={tabBtnStyle(vista === "acumulado")} onClick={() => setVista("acumulado")}>
              Acumulado por cliente
            </button>
            <button style={tabBtnStyle(vista === "vencimiento")} onClick={() => setVista("vencimiento")}>
              Próximas a vencer
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <input
              type="search"
              value={qDeudas}
              onChange={(e) => setQDeudas(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              aria-label="Buscar en deudas"
              style={{ ...inputStyle, flex: "1 1 220px", minWidth: 200, width: "auto" }}
            />
            {vista === "vencimiento" && (
              <select
                value={filtroVencimiento}
                onChange={(e) => setFiltroVencimiento(e.target.value as FiltroVencimiento)}
                aria-label="Filtrar por vencimiento"
                style={{ ...inputStyle, width: "auto", minWidth: 190 }}
              >
                <option value="todas">Todos los vencimientos</option>
                <option value="vencidas">Vencidas</option>
                <option value="proximas">Vencen en 3 días o menos</option>
                <option value="sin_fecha">Sin fecha límite</option>
              </select>
            )}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                color: "var(--muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={soloBloqueados}
                onChange={(e) => setSoloBloqueados(e.target.checked)}
              />
              Solo clientes bloqueados
            </label>
          </div>

          {vista === "acumulado" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem" }}>Persona</th>
                    <th style={{ padding: "0.75rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem" }}>Deuda pendiente acumulada</th>
                    <th style={{ padding: "0.75rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {gruposPage.slice.map((g) => (
                    <>
                      <tr key={g.key} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem" }}>
                          {g.label}
                          {g.telefono && (
                            <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{g.telefono}</div>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {g.id_cliente === null ? (
                            <span style={{ color: "var(--muted)" }}>Sin vincular</span>
                          ) : (
                            <span
                              style={{
                                color: g.cliente_puede_comprar ? "#52b788" : "#e63946",
                                fontWeight: 600,
                              }}
                            >
                              {g.cliente_puede_comprar ? "Activo" : "Bloqueado"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                          Q{g.totalPendiente.toFixed(2)}
                          {g.limite_deuda !== null && (
                            <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                              {" "}
                              / límite Q{g.limite_deuda.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <button
                            onClick={() => toggleExpandido(g.key)}
                            style={{
                              padding: "0.3rem 0.8rem",
                              borderRadius: 6,
                              background: "var(--border)",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            {expandidos.has(g.key) ? "Ocultar detalle" : "Detalle"}
                          </button>
                        </td>
                      </tr>
                      {expandidos.has(g.key) && (
                        <tr key={`${g.key}-detalle`}>
                          <td colSpan={4} style={{ padding: "0 0.75rem 1rem" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                              <thead>
                                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                                  <th style={{ padding: "0.4rem" }}>Fecha inicio</th>
                                  <th style={{ padding: "0.4rem" }}>Fecha límite</th>
                                  <th style={{ padding: "0.4rem" }}>Productos</th>
                                  <th style={{ padding: "0.4rem" }}>Monto</th>
                                  <th style={{ padding: "0.4rem" }}>Estado</th>
                                  <th style={{ padding: "0.4rem" }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.deudas.map((d) => (
                                  <tr key={d.id_deuda} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "0.4rem" }}>
                                      {new Date(d.fecha_inicio).toLocaleDateString("es-GT")}
                                    </td>
                                    <td style={{ padding: "0.4rem" }}>
                                      {d.fecha_limite_pago
                                        ? new Date(d.fecha_limite_pago).toLocaleDateString("es-GT")
                                        : "—"}
                                    </td>
                                    <td style={{ padding: "0.4rem", color: "var(--muted)" }}>
                                      {d.productos.length > 0
                                        ? d.productos.map((p) => `${p.nombre_producto} x${p.cantidad}`).join(", ")
                                        : "—"}
                                    </td>
                                    <td style={{ padding: "0.4rem", fontWeight: 600 }}>
                                      Q{Number(d.monto_total).toFixed(2)}
                                    </td>
                                    <td style={{ padding: "0.4rem" }}>
                                      <span
                                        style={{
                                          color: d.estado_deuda === "PAGADA" ? "#52b788" : "#e63946",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {d.estado_deuda === "PAGADA" ? "Pagada" : "Pendiente"}
                                      </span>
                                    </td>
                                    <td style={{ padding: "0.4rem" }}>
                                      <button
                                        onClick={() => cambiarEstado(d.id_deuda)}
                                        disabled={cambiandoId === d.id_deuda}
                                        style={{
                                          padding: "0.25rem 0.6rem",
                                          borderRadius: 6,
                                          background: d.estado_deuda === "PAGADA" ? "#e63946" : "#52b788",
                                          color: "#fff",
                                          border: "none",
                                          cursor: cambiandoId === d.id_deuda ? "default" : "pointer",
                                          opacity: cambiandoId === d.id_deuda ? 0.6 : 1,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        {cambiandoId === d.id_deuda
                                          ? "…"
                                          : d.estado_deuda === "PAGADA"
                                          ? "Marcar pendiente"
                                          : "Marcar pagada"}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {gruposPage.slice.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)" }}>
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem" }}>Persona</th>
                    <th style={{ padding: "0.75rem" }}>Monto</th>
                    <th style={{ padding: "0.75rem" }}>Fecha límite</th>
                    <th style={{ padding: "0.75rem" }}>Vencimiento</th>
                    <th style={{ padding: "0.75rem" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vencimientoPage.slice.map((d) => {
                    const rest = diasRestantes(d.fecha_limite_pago);
                    return (
                      <tr key={d.id_deuda} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem" }}>
                          {d.nombre_deudor}
                          {d.id_cliente !== null && d.cliente_puede_comprar === false && (
                            <span style={badgeStyle("#e63946")}>bloqueado</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                          Q{Number(d.monto_total).toFixed(2)}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--muted)" }}>
                          {d.fecha_limite_pago
                            ? new Date(d.fecha_limite_pago).toLocaleDateString("es-GT")
                            : "—"}
                        </td>
                        <td style={{ padding: "0.75rem", color: rest.color, fontWeight: 600 }}>
                          {rest.texto}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <button
                            onClick={() => cambiarEstado(d.id_deuda)}
                            disabled={cambiandoId === d.id_deuda}
                            style={{
                              padding: "0.3rem 0.8rem",
                              borderRadius: 6,
                              background: "#52b788",
                              color: "#fff",
                              border: "none",
                              cursor: cambiandoId === d.id_deuda ? "default" : "pointer",
                              opacity: cambiandoId === d.id_deuda ? 0.6 : 1,
                              fontSize: "0.8rem",
                            }}
                          >
                            {cambiandoId === d.id_deuda ? "Guardando…" : "Marcar pagada"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {vencimientoPage.slice.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)" }}>
                        {qDeudas.trim() || soloBloqueados || filtroVencimiento !== "todas"
                          ? "Ningún resultado para esa búsqueda o filtro."
                          : "No hay deudas pendientes."}
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
          <p style={{ color: "var(--muted)", marginBottom: "1rem", maxWidth: 640 }}>
            Define el límite de deuda de cada cliente. Al llegar (o superar) ese monto en deudas
            pendientes, el cliente queda bloqueado automáticamente para comprar o hacer pedidos —
            se desbloquea solo cuando su deuda pendiente vuelve a bajar del límite.
          </p>

          {!creandoCliente && (
            <button
              onClick={() => setCreandoCliente(true)}
              style={{
                marginBottom: "1rem",
                padding: "0.4rem 1rem",
                borderRadius: 6,
                background: "#52b788",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              + Nuevo cliente
            </button>
          )}
          {creandoCliente && (
            <div style={{ maxWidth: 560 }}>
              {formularioClienteNuevo(() => setCreandoCliente(false))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <input
              type="search"
              value={qLimites}
              onChange={(e) => setQLimites(e.target.value)}
              placeholder="Buscar cliente por nombre, teléfono o correo…"
              aria-label="Buscar clientes"
              style={{ ...inputStyle, flex: "1 1 260px", minWidth: 220, width: "auto" }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                color: "var(--muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={soloBloqueados}
                onChange={(e) => setSoloBloqueados(e.target.checked)}
              />
              Solo clientes bloqueados
            </label>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem" }}>Cliente</th>
                  <th style={{ padding: "0.75rem" }}>Estado</th>
                  <th style={{ padding: "0.75rem" }}>Deuda pendiente</th>
                  <th style={{ padding: "0.75rem" }}>Límite de deuda (Q)</th>
                  <th style={{ padding: "0.75rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {clientesPage.slice.map((c) => (
                  <tr key={c.id_cliente} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem" }}>
                      {c.nombre}
                      {c.telefono && (
                        <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{c.telefono}</div>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <span
                        style={{
                          color: c.estado_cliente ? "#52b788" : "#e63946",
                          fontWeight: 600,
                        }}
                      >
                        {c.estado_cliente ? "Activo" : "Bloqueado"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem" }}>Q{deudaPendienteDe(c.id_cliente).toFixed(2)}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Sin límite"
                        style={{ ...inputStyle, width: 130 }}
                        value={limitesEditando[c.id_cliente] ?? ""}
                        onChange={(e) =>
                          setLimitesEditando((prev) => ({ ...prev, [c.id_cliente]: e.target.value }))
                        }
                      />
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <button
                        onClick={() => guardarLimite(c.id_cliente)}
                        disabled={guardandoLimiteId === c.id_cliente}
                        style={{
                          padding: "0.3rem 0.8rem",
                          borderRadius: 6,
                          background: "var(--border)",
                          border: "none",
                          cursor: guardandoLimiteId === c.id_cliente ? "default" : "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        {guardandoLimiteId === c.id_cliente ? "Guardando…" : "Guardar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {clientesPage.slice.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)" }}>
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

    </StaffShell>
  );
}