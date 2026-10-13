"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { isStaffTipo } from "@/lib/roles";
import { Icon } from "@/components/Icon";
import { ProductoAutocompletar } from "@/components/ProductoAutocompletar";
import Link from "next/link";
import { CUOTAS_MAXIMAS, PLAZO_MAXIMO_DIAS, generarCuotas, sumarDias, validarCondicionesCredito } from "@/lib/credito";

type Cliente = {
  id_cliente: number;
  nombre: string;
  correo: string;
  tipo_cliente: string;
  telefono?: string | null;
  limite_deuda?: string | null;
  total_ventas?: number;
};

type Producto = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  precio_unitario: string;
  precio_mayoreo: string;
  unidad_medida: string;
  estado_producto: boolean;
};

type Bodega = { id_bodega: number; nombre_bodega: string };

type StockRow = {
  id_bodega: number;
  id_producto: number;
  cantidad_disponible: string;
};

// Presentación de mayoreo de un producto (ej. "Caja de 24" = 24 unidades base).
type Presentacion = {
  id_presentacion: number;
  nombre_presentacion: string;
  factor_conversion: string;
};

type LineaVenta = {
  key: string;
  id_producto: string;
  id_bodega: string;
  // En unidades de la presentación si hay id_presentacion; si no, en unidad base.
  cantidad: string;
  id_presentacion: string;
  // Precio por unidad BASE del producto.
  precio_unitario_venta: string;
};

type ProductoVentaRow = {
  id_detalle: number;
  id_venta: number;
  codigo_producto: string;
  id_producto: number;
  cantidad: string;
  precio_unitario_venta: string;
  subtotal: string;
};

type VentaListada = {
  id_venta: number;
  id_cliente: number;
  id_empleado: number | null;
  fecha_venta: string;
  estado_venta: string;
  tipo_venta: string;
  tipo_entrega: string;
  direccion_entrega: string | null;
  total: string;
  fecha_limite_pago: string | null;
  condicion_pago?: string;
  id_orden?: number | null;
  estado_pedido?: string | null;
  nombre_cliente: string;
  correo_cliente: string;
  nombre_colaborador: string | null;
  productos: ProductoVentaRow[];
};

// Forma de pago de la venta: de contado se paga completa en el momento; a
// crédito se genera la factura y una cuenta por cobrar con su plan de pagos.
type CondicionPago = "CONTADO" | "CREDITO";

// Estado del pedido de entrega que genera una venta a domicilio.
const ESTADOS_PEDIDO: Record<string, string> = {
  PENDIENTE: "pendiente",
  CONFIRMADO: "confirmado",
  EN_PREPARACION: "en preparación",
  ENVIADO: "enviado",
  ENTREGADO: "entregado",
  CANCELADO: "cancelado",
};

const OPCIONES_PAGOS = [1, 2, 3, 4, 6, 12] as const;
const PLAZOS_RAPIDOS = [15, 30, 45, 60] as const;

// Fecha local (no UTC) en formato AAAA-MM-DD, para no adelantar el día de noche.
function hoyLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatoFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const inputCls =
  "w-full px-3 py-2.5 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-[0.95rem] outline-none focus:ring-2 focus:ring-market/40 transition-shadow";
const labelCls = "font-semibold text-[0.88rem] text-ink-muted";

// Formulario de "+ Cliente nuevo" (mismo patrón que en Deudas, pero acá el
// correo es obligatorio: la venta queda ligada a un cliente localizable).
const clienteFormVacio = {
  nombre: "",
  telefono: "",
  correo: "",
  tipo_cliente: "MINORISTA",
  limite_deuda: "",
};
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nuevaLinea(): LineaVenta {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id_producto: "",
    id_bodega: "",
    cantidad: "",
    id_presentacion: "",
    precio_unitario_venta: "",
  };
}

export default function VentasPage() {
  const router = useRouter();
  const usuario = useStaffSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [ventas, setVentas] = useState<VentaListada[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Confirmación antes de enviar
  const [confirmando, setConfirmando] = useState(false);

  // Deshacer (ventana corta tras registrar)
  const VENTANA_DESHACER_SEGUNDOS = 60;
  const [ventaDeshacer, setVentaDeshacer] = useState<{ id: number; total: number } | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [deshaciendo, setDeshaciendo] = useState(false);

  const [idCliente, setIdCliente] = useState("");
  // Buscador de cliente: en vez de un <select> con todos los clientes, se
  // sugieren de entrada los más frecuentes y se busca el resto por texto.
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [sugerenciasClienteAbiertas, setSugerenciasClienteAbiertas] = useState(false);
  // Alta rápida de cliente sin salir de Ventas
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formCliente, setFormCliente] = useState(clienteFormVacio);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);
  // Confirmación visible bajo el buscador (okMsg solo se muestra tras una venta).
  const [avisoCliente, setAvisoCliente] = useState<string | null>(null);
  const [condicionPago, setCondicionPago] = useState<CondicionPago>("CONTADO");
  // Crédito: la factura lleva por defecto la fecha de hoy; se puede forzar otra.
  const [otraFechaFactura, setOtraFechaFactura] = useState(false);
  const [fechaFactura, setFechaFactura] = useState("");
  const [plazoDias, setPlazoDias] = useState("30");
  const [numeroCuotas, setNumeroCuotas] = useState("1");
  const [creditoGenerado, setCreditoGenerado] = useState<{ numero_factura: string; fecha_limite_pago: string; bloqueado: boolean } | null>(null);
  const [tipoVenta, setTipoVenta] = useState<string>("MINORISTA");
  // El tipo de venta ya no lo escoge el colaborador a mano: se detecta solo
  // según el tipo_cliente que ya tiene guardado el cliente elegido. Este
  // toggle es solo para el caso excepcional de una venta que a propósito no
  // coincide con el tipo habitual de ese cliente.
  const [forzarTipoVenta, setForzarTipoVenta] = useState(false);
  const [tipoEntrega, setTipoEntrega] = useState<string>("EN_TIENDA");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [lineas, setLineas] = useState<LineaVenta[]>([nuevaLinea()]);
  // Presentaciones por producto, cargadas bajo demanda al elegir el producto
  // (undefined = sin cargar, [] = cargadas y sin presentaciones).
  const [presentacionesPorProducto, setPresentacionesPorProducto] = useState<Record<number, Presentacion[]>>({});

  const cargarVentas = useCallback(async () => {
    setLoadingLista(true);
    try {
      const r = await fetch("/api/ventas");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar ventas");
      setVentas(d.ventas || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ventas");
    } finally {
      setLoadingLista(false);
    }
  }, []);

  const cargarClientes = useCallback(async () => {
    const r = await fetch("/api/clientes", { cache: "no-store" });
    const d = await r.json();
    setClientes(d.clientes || []);
  }, []);

  useEffect(() => {
    if (!usuario) return;
    // Ventas es de dueño y colaborador: el dueño también vende (y hace pedidos).
    if (!isStaffTipo(usuario.tipo_usuario)) return;
    cargarClientes();
    fetch("/api/productos").then((r) => r.json()).then((d) => setProductos(d.productos || []));
    fetch("/api/bodegas").then((r) => r.json()).then((d) => setBodegas(d.bodegas || []));
    fetch("/api/gestion-inventario").then((r) => r.json()).then((d) => {
      setStock((d.stock || []).map((r: Record<string, unknown>) => ({
        id_bodega: r.id_bodega as number,
        id_producto: r.id_producto as number,
        cantidad_disponible: String(r.cantidad_disponible ?? 0),
      })));
    });
    cargarVentas();
  }, [usuario, cargarVentas, cargarClientes, router]);

  // Si el colaborador deja la pestaña de Ventas abierta y el dueño bloquea
  // (o desbloquea) a un cliente por deuda mientras tanto, esto refresca la
  // lista al volver — así nunca queda desactualizada.
  useEffect(() => {
    if (!usuario || !isStaffTipo(usuario.tipo_usuario)) return;
    function onFocus() {
      cargarClientes();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") cargarClientes();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [usuario, cargarClientes]);

  // Cuenta regresiva del botón "Deshacer" — se apaga sola al llegar a 0.
  useEffect(() => {
    if (!ventaDeshacer || segundosRestantes <= 0) {
      if (segundosRestantes <= 0) setVentaDeshacer(null);
      return;
    }
    const t = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [ventaDeshacer, segundosRestantes]);

  const productoPorId = useMemo(() => {
    const m = new Map<number, Producto>();
    productos.forEach((p) => m.set(p.id_producto, p));
    return m;
  }, [productos]);

  const productosActivos = useMemo(() => productos.filter((p) => p.estado_producto), [productos]);

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => String(c.id_cliente) === idCliente),
    [clientes, idCliente]
  );

  // Los 5 clientes con más ventas registradas — sugerencia por defecto
  // cuando el buscador todavía está vacío.
  const clientesDestacados = useMemo(() => {
    return [...clientes]
      .sort((a, b) => (b.total_ventas ?? 0) - (a.total_ventas ?? 0) || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }, [clientes]);

  const clientesSugeridos = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (q === "") return clientesDestacados;
    return clientes
      .filter((c) => c.nombre.toLowerCase().includes(q) || c.correo.toLowerCase().includes(q))
      .slice(0, 8);
  }, [busquedaCliente, clientes, clientesDestacados]);

  const stockDisponible = useCallback((idProducto: string, idBodega: string): number => {
    const idP = Number(idProducto);
    const idB = Number(idBodega);
    if (!idP || !idB) return 0;
    const row = stock.find((s) => s.id_producto === idP && s.id_bodega === idB);
    return row ? Number(row.cantidad_disponible) : 0;
  }, [stock]);

  const cargarPresentacionesSiFalta = useCallback(async (idProducto: number) => {
    if (!idProducto || presentacionesPorProducto[idProducto] !== undefined) return;
    try {
      const r = await fetch(`/api/presentaciones?id_producto=${idProducto}`);
      const d = await r.json();
      setPresentacionesPorProducto((prev) => ({ ...prev, [idProducto]: d.presentaciones || [] }));
    } catch {
      setPresentacionesPorProducto((prev) => ({ ...prev, [idProducto]: [] }));
    }
  }, [presentacionesPorProducto]);

  // Cantidad en unidad base (convierte si la línea viene en una presentación,
  // ej. 3 "Caja de 24" => 72).
  function factorDeLinea(ln: LineaVenta): number {
    if (!ln.id_presentacion) return 1;
    const lista = presentacionesPorProducto[Number(ln.id_producto)] || [];
    const pres = lista.find((p) => p.id_presentacion === Number(ln.id_presentacion));
    return pres ? Number(pres.factor_conversion) || 1 : 1;
  }

  const totalBorrador = useMemo(() => {
    let t = 0;
    for (const ln of lineas) {
      const q = Number(ln.cantidad) * factorDeLinea(ln);
      const pu = Number(ln.precio_unitario_venta);
      if (q > 0 && pu >= 0 && !Number.isNaN(q) && !Number.isNaN(pu)) {
        t += Math.round(q * pu * 100) / 100;
      }
    }
    return Math.round(t * 100) / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, presentacionesPorProducto]);

  // ── Crédito: fecha efectiva de la factura y vista previa del plan de pagos ──
  const fechaFacturaEfectiva = otraFechaFactura && fechaFactura ? fechaFactura : hoyLocalISO();
  const errorCredito = useMemo(() => {
    if (condicionPago !== "CREDITO") return null;
    if (otraFechaFactura && !fechaFactura) return "Elige la fecha de la factura";
    return validarCondicionesCredito(Number(plazoDias), Number(numeroCuotas));
  }, [condicionPago, otraFechaFactura, fechaFactura, plazoDias, numeroCuotas]);
  const planCuotas = useMemo(() => {
    if (condicionPago !== "CREDITO" || errorCredito || totalBorrador <= 0) return [];
    try {
      return generarCuotas(fechaFacturaEfectiva, Number(plazoDias), Number(numeroCuotas), totalBorrador);
    } catch {
      return [];
    }
  }, [condicionPago, errorCredito, totalBorrador, fechaFacturaEfectiva, plazoDias, numeroCuotas]);

  if (!usuario) return <p className="p-8 text-ink-muted">Cargando…</p>;
  if (!isStaffTipo(usuario.tipo_usuario)) return <p className="p-8 text-ink-muted">Redirigiendo…</p>;

  function precioSugerido(p: Producto | undefined): string {
    if (!p) return "";
    const v = tipoVenta === "MAYORISTA" ? Number(p.precio_mayoreo) : Number(p.precio_unitario);
    if (Number.isNaN(v)) return "";
    return String(v);
  }

  function actualizarLinea(key: string, patch: Partial<LineaVenta>) {
    setLineas((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    setError(null); setOkMsg(null);
  }

  function onProductoChange(key: string, idStr: string) {
    const id = Number(idStr);
    const p = productoPorId.get(id);
    setLineas((prev) => prev.map((ln) => ln.key === key ? { ...ln, id_producto: idStr, id_presentacion: "", precio_unitario_venta: p ? precioSugerido(p) : ln.precio_unitario_venta } : ln));
    if (id) cargarPresentacionesSiFalta(id);
    setError(null); setOkMsg(null);
  }

  function aplicarPreciosPorTipo(nuevoTipo: string) {
    setLineas((prev) => prev.map((ln) => {
      if (!ln.id_producto) return ln;
      const p = productoPorId.get(Number(ln.id_producto));
      if (!p) return ln;
      const v = nuevoTipo === "MAYORISTA" ? Number(p.precio_mayoreo) : Number(p.precio_unitario);
      if (Number.isNaN(v)) return ln;
      return { ...ln, precio_unitario_venta: String(v) };
    }));
  }

  function onClienteChange(idStr: string) {
    setIdCliente(idStr);
    setError(null); setOkMsg(null);
    // Detección automática: el tipo de venta pasa a ser el tipo_cliente del
    // cliente elegido, a menos que el colaborador ya esté forzando otro tipo
    // a propósito.
    if (!forzarTipoVenta) {
      const c = clientes.find((c) => String(c.id_cliente) === idStr);
      const detectado = c?.tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";
      setTipoVenta(detectado);
      aplicarPreciosPorTipo(detectado);
    }
  }

  function seleccionarCliente(c: Cliente) {
    onClienteChange(String(c.id_cliente));
    setBusquedaCliente(`${c.nombre} (${c.correo})`);
    setSugerenciasClienteAbiertas(false);
  }

  async function crearCliente() {
    const nombre = formCliente.nombre.trim();
    const correo = formCliente.correo.trim();
    if (!nombre) {
      setErrorCliente("El nombre del cliente nuevo es obligatorio");
      return;
    }
    if (!correo) {
      setErrorCliente("El correo es obligatorio para crear un cliente desde Ventas");
      return;
    }
    if (!CORREO_VALIDO.test(correo)) {
      setErrorCliente("Escribe un correo válido (ej. nombre@correo.com)");
      return;
    }
    const limite = formCliente.limite_deuda.trim() === "" ? null : Number(formCliente.limite_deuda);
    if (limite !== null && (!Number.isFinite(limite) || limite < 0)) {
      setErrorCliente("El límite de crédito debe ser un número mayor o igual a 0");
      return;
    }

    setGuardandoCliente(true);
    setErrorCliente(null);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          correo,
          telefono: formCliente.telefono.trim(),
          tipo_cliente: formCliente.tipo_cliente,
          limite_deuda: limite,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorCliente(data.error || "No se pudo crear el cliente");
        return;
      }
      const nuevo: Cliente = data.cliente;
      setClientes((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));

      // Se deja seleccionado de una vez. onClienteChange no sirve acá porque
      // busca en `clientes`, que todavía no incluye al recién creado.
      setIdCliente(String(nuevo.id_cliente));
      setBusquedaCliente(`${nuevo.nombre} (${nuevo.correo})`);
      setSugerenciasClienteAbiertas(false);
      if (!forzarTipoVenta) {
        const detectado = nuevo.tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";
        setTipoVenta(detectado);
        aplicarPreciosPorTipo(detectado);
      }
      setError(null);
      setAvisoCliente(`Cliente "${nuevo.nombre}" creado y seleccionado ✓`);
      setCreandoCliente(false);
      setFormCliente(clienteFormVacio);
    } catch {
      setErrorCliente("Error de conexión al crear el cliente");
    } finally {
      setGuardandoCliente(false);
    }
  }

  function limpiarClienteSeleccionado() {
    setAvisoCliente(null);
    setBusquedaCliente("");
    setSugerenciasClienteAbiertas(false);
    onClienteChange("");
  }

  function onForzarTipoVentaChange(activar: boolean) {
    setForzarTipoVenta(activar);
    if (!activar) {
      // Al desactivar el forzado, se vuelve a lo que detecta el cliente
      // actual (o Minorista si todavía no hay cliente elegido).
      const detectado = clienteSeleccionado?.tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";
      setTipoVenta(detectado);
      aplicarPreciosPorTipo(detectado);
    }
  }

  async function handleSubmit() {
    setLoadingSubmit(true); setError(null); setOkMsg(null);
    try {
      const lineasPayload = lineas
        .filter((ln) => ln.id_producto && ln.id_bodega && ln.cantidad && ln.precio_unitario_venta)
        .map((ln) => ({
          id_producto: Number(ln.id_producto),
          id_bodega: Number(ln.id_bodega),
          cantidad: Number(ln.cantidad),
          id_presentacion: ln.id_presentacion ? Number(ln.id_presentacion) : undefined,
          precio_unitario_venta: Number(ln.precio_unitario_venta),
        }));
      const res = await fetch("/api/ventas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cliente: Number(idCliente),
          condicion_pago: condicionPago,
          credito: condicionPago === "CREDITO"
            ? { fecha_factura: fechaFacturaEfectiva, plazo_dias: Number(plazoDias), numero_cuotas: Number(numeroCuotas) }
            : undefined,
          tipo_venta: tipoVenta, forzar_tipo_venta: forzarTipoVenta, tipo_entrega: tipoEntrega,
          direccion_entrega: tipoEntrega === "DOMICILIO" ? direccionEntrega.trim() : undefined,
          lineas: lineasPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo registrar la venta"); return; }
      if (data.credito) {
        setOkMsg(`Venta #${data.id_venta} a crédito registrada. Total: Q${Number(data.total).toFixed(2)} · Factura ${data.credito.numero_factura}${data.id_orden ? ` · Pedido de entrega #${data.id_orden}` : ""}`);
        setCreditoGenerado({
          numero_factura: data.credito.numero_factura,
          fecha_limite_pago: data.credito.fecha_limite_pago,
          bloqueado: !!data.credito.alerta?.bloqueado,
        });
      } else {
        setOkMsg(`Venta #${data.id_venta} registrada. Total: Q${Number(data.total).toFixed(2)}${data.id_orden ? ` · Pedido de entrega #${data.id_orden}` : ""}`);
        setCreditoGenerado(null);
      }
      setVentaDeshacer({ id: data.id_venta, total: Number(data.total) });
      setSegundosRestantes(VENTANA_DESHACER_SEGUNDOS);
      setIdCliente(""); setBusquedaCliente(""); setCondicionPago("CONTADO"); setOtraFechaFactura(false); setFechaFactura(""); setPlazoDias("30"); setNumeroCuotas("1"); setTipoVenta("MINORISTA"); setForzarTipoVenta(false); setTipoEntrega("EN_TIENDA");
      setDireccionEntrega(""); setLineas([nuevaLinea()]);
      await cargarVentas();
    } catch { setError("No se pudo conectar con el servidor"); }
    finally { setLoadingSubmit(false); setConfirmando(false); }
  }

  async function handleDeshacer() {
    if (!ventaDeshacer) return;
    setDeshaciendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventas/${ventaDeshacer.id}/anular`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo deshacer la venta"); return; }
      setOkMsg(null);
      setVentaDeshacer(null);
      await cargarVentas();
    } catch { setError("No se pudo conectar con el servidor"); }
    finally { setDeshaciendo(false); }
  }

  const puedeEnviar = idCliente && lineas.some((ln) => ln.id_producto && ln.id_bodega && ln.cantidad && Number(ln.cantidad) > 0) && (tipoEntrega === "EN_TIENDA" || direccionEntrega.trim().length > 0) && (condicionPago === "CONTADO" || (!errorCredito && totalBorrador > 0));

  return (
    <StaffShell usuario={usuario} title="Ventas" subtitle="Registro de ventas, créditos y pedidos de entrega">
      <div className="flex flex-col gap-8">
        <div className="max-w-[720px] flex justify-end -mb-5">
          <Link href="/ordenes" className="text-[0.85rem] font-semibold text-market-600 hover:underline">
            Ver pedidos de entrega →
          </Link>
        </div>
        <div className="max-w-[720px] bg-white border border-[var(--border)] rounded-card shadow-warm p-7">

          {/* Encabezado del formulario */}
          <div className="flex items-center gap-4 mb-6 border-b-2 border-market pb-4">
            <div className="w-12 h-12 rounded-control bg-market/10 border border-market/25 flex items-center justify-center shrink-0">
              <Icon name="bill" variant="dark" size={26} />
            </div>
            <div>
              <p className="m-0 text-ink-muted text-[0.88rem]">
                Cada venta guarda la transacción (<code>venta</code>) y los productos (<code>detalle_venta</code>). Cada producto puede salir de una bodega distinta; el inventario se descuenta por bodega y queda trazado en kardex.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Cliente *</label>
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="Buscar cliente por nombre o correo…"
                  value={busquedaCliente}
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value);
                    setSugerenciasClienteAbiertas(true);
                    if (idCliente) onClienteChange("");
                  }}
                  onFocus={() => setSugerenciasClienteAbiertas(true)}
                  onBlur={() => setTimeout(() => setSugerenciasClienteAbiertas(false), 150)}
                />
                {idCliente && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={limpiarClienteSeleccionado}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-sm"
                    title="Cambiar de cliente"
                  >
                    ✕
                  </button>
                )}
                {sugerenciasClienteAbiertas && (
                  <div className="absolute z-20 top-[calc(100%+4px)] left-0 right-0 bg-white border border-[var(--border)] rounded-control shadow-warm max-h-56 overflow-y-auto">
                    {busquedaCliente.trim() === "" && (
                      <div className="px-3 py-1.5 text-[0.72rem] text-ink-muted uppercase tracking-wide">
                        Clientes frecuentes
                      </div>
                    )}
                    {clientesSugeridos.length === 0 && (
                      <div className="px-3 py-2 text-[0.85rem] text-ink-muted">Sin resultados</div>
                    )}
                    {clientesSugeridos.map((c) => (
                      <div
                        key={c.id_cliente}
                        onMouseDown={(e) => {
                          // Sin esto, el navegador le quita el foco al input
                          // ANTES de que corra este click (mousedown ocurre
                          // antes del blur), lo que dispara un blur real de
                          // más que compite con el cierre del dropdown que
                          // ya hace seleccionarCliente.
                          e.preventDefault();
                          seleccionarCliente(c);
                        }}
                        className="px-3 py-2 text-[0.88rem] text-ink cursor-pointer hover:bg-cream/60 border-b border-[var(--border)] last:border-b-0 flex justify-between items-center gap-2"
                      >
                        <span>{c.nombre} ({c.correo})</span>
                        {!!c.total_ventas && (
                          <span className="text-[0.72rem] text-ink-muted whitespace-nowrap">
                            {c.total_ventas} venta{c.total_ventas === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setCreandoCliente((v) => !v);
                    setErrorCliente(null);
                    setAvisoCliente(null);
                  }}
                  className="text-[0.84rem] font-semibold text-market-600 hover:underline"
                >
                  {creandoCliente ? "Cancelar cliente nuevo" : "+ Cliente nuevo"}
                </button>
              </div>

              {avisoCliente && idCliente && !creandoCliente && (
                <div className="text-[0.85rem] text-market-600 font-medium">{avisoCliente}</div>
              )}

              {creandoCliente && (
                <div className="flex flex-col gap-2.5 p-3 border border-dashed border-[var(--border)] rounded-control">
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Nombre *</label>
                      <input
                        className={inputCls}
                        value={formCliente.nombre}
                        onChange={(e) => setFormCliente((f) => ({ ...f, nombre: e.target.value }))}
                        placeholder="Nombre del cliente"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Teléfono</label>
                      <input
                        className={inputCls}
                        value={formCliente.telefono}
                        onChange={(e) => setFormCliente((f) => ({ ...f, telefono: e.target.value }))}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Correo *</label>
                      <input
                        type="email"
                        className={inputCls}
                        value={formCliente.correo}
                        onChange={(e) => setFormCliente((f) => ({ ...f, correo: e.target.value }))}
                        placeholder="nombre@correo.com"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Tipo de cliente</label>
                      <select
                        className={inputCls}
                        value={formCliente.tipo_cliente}
                        onChange={(e) => setFormCliente((f) => ({ ...f, tipo_cliente: e.target.value }))}
                      >
                        <option value="MINORISTA">Minorista</option>
                        <option value="MAYORISTA">Mayorista</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Límite de crédito (opcional)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={inputCls}
                      value={formCliente.limite_deuda}
                      onChange={(e) => setFormCliente((f) => ({ ...f, limite_deuda: e.target.value }))}
                      placeholder="Sin límite"
                    />
                  </div>
                  {errorCliente && (
                    <div className="text-[0.85rem] text-achiote-600 font-medium">{errorCliente}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={crearCliente}
                      disabled={guardandoCliente}
                      className="bg-market text-white border-none rounded-control px-4 py-2 text-[0.88rem] font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {guardandoCliente ? "Creando…" : "Crear cliente"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreandoCliente(false);
                        setFormCliente(clienteFormVacio);
                        setErrorCliente(null);
                      }}
                      className="bg-transparent border border-[var(--border)] text-ink-muted rounded-control px-4 py-2 text-[0.88rem] font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                <label className={labelCls}>Forma de pago *</label>
                <div className="flex gap-2" role="group" aria-label="Forma de pago">
                  {([
                    { v: "CONTADO", t: "Contado" },
                    { v: "CREDITO", t: "Crédito" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      aria-pressed={condicionPago === o.v}
                      onClick={() => { setCondicionPago(o.v); setError(null); }}
                      className={`flex-1 px-3 py-2.5 rounded-control border text-[0.95rem] font-semibold transition-colors ${
                        condicionPago === o.v
                          ? "bg-market text-white border-market"
                          : "bg-transparent text-ink-muted border-[var(--border)] hover:bg-cream"
                      }`}
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
                <span className="text-[0.78rem] text-ink-muted">
                  {condicionPago === "CONTADO"
                    ? "El cliente paga el total en este momento."
                    : "Se genera la factura y una cuenta por cobrar."}
                </span>
              </div>
              <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                <label className={labelCls}>Tipo de venta</label>
                {forzarTipoVenta ? (
                  <select value={tipoVenta} onChange={(e) => { const v = e.target.value; setTipoVenta(v); aplicarPreciosPorTipo(v); setError(null); }} className={inputCls}>
                    <option value="MINORISTA">Minorista</option>
                    <option value="MAYORISTA">Mayorista</option>
                  </select>
                ) : (
                  <div className={`${inputCls} flex items-center justify-between bg-cream/30 cursor-default`}>
                    <span>{tipoVenta === "MAYORISTA" ? "Mayorista" : "Minorista"}</span>
                    <span className="text-[0.72rem] text-ink-muted">
                      {idCliente ? "detectado del cliente" : "por defecto"}
                    </span>
                  </div>
                )}
                <label className="flex items-center gap-2 text-[0.78rem] text-ink-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forzarTipoVenta}
                    onChange={(e) => onForzarTipoVentaChange(e.target.checked)}
                  />
                  Forzar un tipo distinto al del cliente
                </label>
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                <label className={labelCls}>Tipo de entrega *</label>
                <select value={tipoEntrega} onChange={(e) => { setTipoEntrega(e.target.value); setError(null); }} className={inputCls}>
                  <option value="EN_TIENDA">En tienda</option>
                  <option value="DOMICILIO">Domicilio</option>
                </select>
              </div>
            </div>

            {tipoEntrega === "DOMICILIO" && (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Dirección de entrega *</label>
                <input value={direccionEntrega} onChange={(e) => setDireccionEntrega(e.target.value)} placeholder="Zona, calle, referencias…" className={inputCls} />
              </div>
            )}

            {condicionPago === "CREDITO" && (
              <div className="flex flex-col gap-3 p-4 border border-market/40 bg-market-50/50 rounded-control">
                <div className="font-semibold text-[0.9rem] text-market-600">Condiciones del crédito</div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Fecha de la factura</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {otraFechaFactura ? (
                      <input
                        type="date"
                        value={fechaFactura}
                        max={hoyLocalISO()}
                        min={sumarDias(hoyLocalISO(), -365)}
                        onChange={(e) => setFechaFactura(e.target.value)}
                        className={`${inputCls} max-w-[200px]`}
                        aria-label="Fecha de la factura"
                      />
                    ) : (
                      <span className="text-[0.95rem] text-ink">Hoy, {formatoFecha(hoyLocalISO())}</span>
                    )}
                    <label className="flex items-center gap-2 text-[0.85rem] text-ink-muted">
                      <input
                        type="checkbox"
                        checked={otraFechaFactura}
                        onChange={(e) => { setOtraFechaFactura(e.target.checked); if (!e.target.checked) setFechaFactura(""); }}
                      />
                      Elegir otra fecha
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                    <label className={labelCls}>Plazo para pagar (días)</label>
                    <input
                      type="number"
                      min={1}
                      max={PLAZO_MAXIMO_DIAS}
                      value={plazoDias}
                      onChange={(e) => setPlazoDias(e.target.value)}
                      className={inputCls}
                      aria-label="Plazo en días"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {PLAZOS_RAPIDOS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPlazoDias(String(d))}
                          className={`px-2.5 py-1 rounded-control border text-[0.78rem] font-semibold ${
                            Number(plazoDias) === d ? "bg-market text-white border-market" : "border-[var(--border)] text-ink-muted hover:bg-cream"
                          }`}
                        >
                          {d} días
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                    <label className={labelCls}>Forma de pago del crédito</label>
                    <select value={numeroCuotas} onChange={(e) => setNumeroCuotas(e.target.value)} className={inputCls} aria-label="Número de pagos">
                      {OPCIONES_PAGOS.filter((n) => n <= CUOTAS_MAXIMAS).map((n) => (
                        <option key={n} value={n}>{n === 1 ? "Pago único" : `${n} pagos`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {errorCredito ? (
                  <div className="text-[0.85rem] text-achiote-600 font-medium">{errorCredito}</div>
                ) : planCuotas.length > 0 ? (
                  <div className="flex flex-col gap-1" aria-label="Plan de pagos">
                    <div className="text-[0.82rem] font-semibold text-ink-muted">Plan de pagos</div>
                    {planCuotas.map((c) => (
                      <div key={c.numero} className="flex justify-between text-[0.9rem] text-ink">
                        <span>
                          {planCuotas.length === 1 ? "Pago único" : `Pago ${c.numero}`} · vence {formatoFecha(c.fecha_vencimiento)}
                        </span>
                        <span className="font-semibold">Q{c.monto.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[0.85rem] text-ink-muted">Agrega productos para ver el plan de pagos.</div>
                )}
              </div>
            )}

<div className="mt-2">
  <div className="font-semibold text-[0.9rem] mb-3 text-ink">Productos</div>
  <div className="flex flex-col gap-4">
    {lineas.map((ln) => {
      const pSel = ln.id_producto ? productoPorId.get(Number(ln.id_producto)) : undefined;
      const disponible = stockDisponible(ln.id_producto, ln.id_bodega);
      const presentaciones = presentacionesPorProducto[Number(ln.id_producto)] || [];
      return (
        <div
          key={ln.key}
          className="grid gap-x-2 gap-y-3 items-end"
          style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1fr) auto" }}
        >
          {/* Fila 1: Producto + quitar */}
          <div className="flex flex-col gap-1.5" style={{ gridColumn: "1 / span 4", gridRow: 1 }}>
            <label className={labelCls}>Producto</label>
            <ProductoAutocompletar
              productos={productosActivos}
              value={ln.id_producto}
              onChange={(id) => onProductoChange(ln.key, id)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            style={{ gridColumn: 5, gridRow: 1 }}
            onClick={() => setLineas((prev) => prev.length <= 1 ? prev : prev.filter((x) => x.key !== ln.key))}
            disabled={lineas.length <= 1}
            title="Quitar línea"
            className="h-10 w-10 flex items-center justify-center rounded-control border border-[var(--border)] bg-cream/60 text-ink-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-achiote-50 enabled:hover:text-achiote-600"
          >
            <Icon name="close" variant="dark" size={14} />
          </button>

          {/* Fila 2: Bodega, Cantidad, Presentación, Precio */}
          <div className="flex flex-col gap-1.5" style={{ gridColumn: 1, gridRow: 2 }}>
            <label className={labelCls}>Bodega *</label>
            <select
              value={ln.id_bodega}
              onChange={(e) => { actualizarLinea(ln.key, { id_bodega: e.target.value }); setError(null); setOkMsg(null); }}
              className={inputCls}
            >
              <option value="">— Bodega —</option>
              {bodegas.map((b) => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5" style={{ gridColumn: 2, gridRow: 2 }}>
            <label className={labelCls}>Cantidad</label>
            <input
              type="number" min="0.001" step="0.001"
              value={ln.cantidad}
              onChange={(e) => actualizarLinea(ln.key, { cantidad: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5" style={{ gridColumn: 3, gridRow: 2 }}>
            <label className={labelCls}>Presentación</label>
            <select
              value={ln.id_presentacion}
              onChange={(e) => actualizarLinea(ln.key, { id_presentacion: e.target.value })}
              className={inputCls}
              disabled={presentaciones.length === 0}
              aria-label="Presentación"
            >
              <option value="">Unidad</option>
              {presentaciones.map((pr) => (
                <option key={pr.id_presentacion} value={pr.id_presentacion}>
                  {pr.nombre_presentacion} (×{Number(pr.factor_conversion)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5" style={{ gridColumn: 4, gridRow: 2 }}>
            <label className={labelCls}>P. venta</label>
            <input
              type="number" min="0" step="0.01"
              value={ln.precio_unitario_venta}
              onChange={(e) => actualizarLinea(ln.key, { precio_unitario_venta: e.target.value })}
              className={inputCls}
            />
          </div>

          {/* Fila 3: info */}
          {(pSel || (ln.id_presentacion && Number(ln.cantidad) > 0)) && (
            <span className="col-span-full text-[0.78rem] text-ink-muted">
              {pSel && <>Unidad: {pSel.unidad_medida}</>}
              {ln.id_bodega && (
                <> · Disponible en bodega: <strong className={disponible > 0 ? "text-market-600" : "text-achiote-600"}>{disponible}</strong></>
              )}
              {ln.id_presentacion && Number(ln.cantidad) > 0 && (
                <> · = {(Number(ln.cantidad) * factorDeLinea(ln)).toLocaleString("es-GT")} unidades</>
              )}
            </span>
          )}
        </div>
      );
    })}
  </div>
  <button
    type="button"
    onClick={() => setLineas((prev) => [...prev, nuevaLinea()])}
    className="mt-3 px-3.5 py-2 rounded-control border border-market bg-transparent text-market-600 font-semibold text-[0.88rem] transition-transform active:scale-[0.97] hover:bg-market-50"
  >
    + Agregar producto
  </button>
</div>

            <div className="flex justify-between items-center mt-2 pt-4 border-t border-[var(--border)]">
              <span className="font-bold text-ink">Total: Q{totalBorrador.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={loadingSubmit || !puedeEnviar}
                className="bg-market text-white border-none rounded-control px-6 py-3.5 text-base font-semibold transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Registrar venta
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-achiote-50 border border-achiote/30 rounded-control px-4 py-3 text-achiote-600">
              {error}
            </div>
          )}
          {okMsg && ventaDeshacer && (
            <div key={okMsg} className="mt-4 bg-market-50 border border-market/35 rounded-control px-4 py-3 text-market-600 font-medium flex items-center gap-3 flex-wrap animate-stamp">
              <span className="inline-flex w-5 h-5 rounded-full bg-market text-white items-center justify-center text-xs shrink-0">✓</span>
              <span className="flex-1">
                {okMsg}
                {creditoGenerado && (
                  <>
                    {" "}· vence {formatoFecha(creditoGenerado.fecha_limite_pago)}.
                    {creditoGenerado.bloqueado && (
                      <span className="block text-achiote-600 font-semibold mt-1">
                        ⚠️ Este cliente alcanzó su límite de crédito y quedó bloqueado para nuevas compras.
                      </span>
                    )}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={handleDeshacer}
                disabled={deshaciendo}
                className="bg-transparent border border-market text-market-600 rounded-control px-3 py-1.5 text-[0.85rem] font-semibold transition-transform active:scale-[0.97] hover:bg-market disabled:opacity-60 disabled:cursor-not-allowed hover:text-white"
              >
                {deshaciendo ? "Deshaciendo…" : `Deshacer (${segundosRestantes}s)`}
              </button>
            </div>
          )}
        </div>

        {/* ── Modal de confirmación antes de enviar ── */}
        {confirmando && (
          <div
            className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmando(false)}
          >
            <div
              className="bg-white rounded-card shadow-warm-lg p-6 max-w-[420px] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-head text-lg font-bold text-ink mb-2">¿Confirmar esta venta?</h3>
              <p className="text-ink-muted text-[0.9rem] mb-4">
                {clientes.find((c) => String(c.id_cliente) === idCliente)?.nombre ?? "Cliente"} ·{" "}
                {lineas.filter((l) => l.id_producto).length} producto(s) · Total: Q{totalBorrador.toFixed(2)}
              </p>
              {condicionPago === "CREDITO" ? (
                <p className="text-ink text-[0.88rem] mb-4 bg-market-50 border border-market/30 rounded-control px-3 py-2">
                  <strong>A crédito</strong> · factura del {formatoFecha(fechaFacturaEfectiva)} · plazo de {plazoDias} días ·{" "}
                  {Number(numeroCuotas) === 1 ? "pago único" : `${numeroCuotas} pagos`}. Se generará la factura y una cuenta por cobrar.
                </p>
              ) : (
                <p className="text-ink-muted text-[0.88rem] mb-4">De contado: el cliente paga el total ahora.</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="px-4 py-2 rounded-control border border-[var(--border)] text-ink-muted text-sm font-medium hover:bg-cream"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loadingSubmit}
                  className="px-4 py-2 rounded-control bg-market text-white text-sm font-semibold transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-70"
                >
                  {loadingSubmit ? "Guardando…" : "Sí, registrar venta"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-head text-[1.15rem] mb-4 text-market-600">Ventas recientes</h2>
          {loadingLista ? (
            <p className="text-ink-muted">Cargando historial…</p>
          ) : (
            <div className="overflow-x-auto border border-[var(--border)] rounded-card bg-white shadow-warm">
              <table className="w-full border-collapse min-w-[920px]">
                <thead>
                  <tr className="bg-market">
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">#</th>
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Fecha</th>
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Cliente</th>
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Colaborador</th>
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Estado pago</th>
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Tipo</th>
                    <th className="px-3.5 py-2.5 text-right text-[0.82rem] font-semibold text-white">Total</th>
                    <th className="px-3.5 py-2.5 text-left text-[0.82rem] font-semibold text-white">Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v, i) => (
                    <tr key={v.id_venta} className={`align-top ${i % 2 === 0 ? "bg-cream/40" : "bg-white"}`}>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{v.id_venta}</td>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{new Date(v.fecha_venta).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">
                        <div className="font-medium">{v.nombre_cliente}</div>
                        <div className="text-[0.78rem] text-ink-muted">{v.correo_cliente}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{v.nombre_colaborador ?? "—"}</td>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{v.condicion_pago === "CREDITO" ? `Crédito · ${v.estado_venta}` : v.estado_venta}
                      {v.id_orden && v.estado_pedido && (
                        <span className="block text-[0.75rem] text-ink-muted">Pedido: {ESTADOS_PEDIDO[v.estado_pedido] ?? v.estado_pedido}</span>
                      )}
                    </td>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{v.tipo_venta}</td>
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)] text-right font-semibold">Q{Number(v.total).toFixed(2)}</td>
                      <td className="px-3.5 py-2.5 text-[0.82rem] border-b border-[var(--border)] max-w-[320px]">
                        {(v.productos || []).map((pr) => (
                          <div key={pr.id_detalle} className="mb-1.5">
                            <span className="text-ink">{pr.codigo_producto}</span>{" "}× {Number(pr.cantidad).toFixed(3)} @ Q{Number(pr.precio_unitario_venta).toFixed(2)} → Q{Number(pr.subtotal).toFixed(2)}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ventas.length === 0 && <p className="p-5 text-ink-muted m-0">Aún no hay ventas registradas.</p>}
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}