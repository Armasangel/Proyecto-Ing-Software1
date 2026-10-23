"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/hooks/useStaffSession";
import { isStaffTipo } from "@/lib/roles";
import { CUOTAS_MAXIMAS, generarCuotas, validarCondicionesCredito } from "@/lib/credito";
import { elegirMejorDescuento, type Descuento as ReglaDescuento } from "@/lib/descuentos";
import { etiquetaTipoDocumento, type TipoDocumento } from "@/lib/tipos-documento";
import { VENTANA_DESHACER_SEGUNDOS } from "@/lib/constants/ventas";
import {
  factorDeLinea as factorDeLineaBase,
  hoyLocalISO,
  nuevaLinea,
} from "@/lib/ventas-utils";
import type {
  Bodega,
  Cliente,
  CondicionPago,
  CreditoGenerado,
  LineaVenta,
  Presentacion,
  Producto,
  StockRow,
  VentaDeshacer,
  VentaListada,
} from "@/lib/types/ventas";
import type { ClienteCreado } from "@/lib/clientes-form";

export function useVentas() {
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
  const [confirmando, setConfirmando] = useState(false);
  const [ventaDeshacer, setVentaDeshacer] = useState<VentaDeshacer | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [idCliente, setIdCliente] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [avisoCliente, setAvisoCliente] = useState<string | null>(null);
  const [condicionPago, setCondicionPago] = useState<CondicionPago>("CONTADO");
  const [otraFechaFactura, setOtraFechaFactura] = useState(false);
  const [fechaFactura, setFechaFactura] = useState("");
  const [plazoDias, setPlazoDias] = useState("30");
  const [numeroCuotas, setNumeroCuotas] = useState("1");
  const [tipoDocumentoCredito, setTipoDocumentoCredito] = useState<TipoDocumento>("FACTURA");
  const [creditoGenerado, setCreditoGenerado] = useState<CreditoGenerado | null>(null);
  const [tipoVenta, setTipoVenta] = useState<string>("MINORISTA");
  const [forzarTipoVenta, setForzarTipoVenta] = useState(false);
  const [tipoEntrega, setTipoEntrega] = useState<string>("EN_TIENDA");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [lineas, setLineas] = useState<LineaVenta[]>([nuevaLinea()]);
  const [presentacionesPorProducto, setPresentacionesPorProducto] = useState<Record<number, Presentacion[]>>({});
  const [descuentosAplicables, setDescuentosAplicables] = useState<ReglaDescuento[]>([]);

  useEffect(() => {
    if (!idCliente) {
      setDescuentosAplicables([]);
      return;
    }
    let cancelado = false;
    fetch(`/api/descuentos/aplicables?id_cliente=${idCliente}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelado) setDescuentosAplicables(d.descuentos || []);
      })
      .catch(() => {
        if (!cancelado) setDescuentosAplicables([]);
      });
    return () => {
      cancelado = true;
    };
  }, [idCliente]);

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

  const clientesDestacados = useMemo(() => {
    return [...clientes]
      .sort((a, b) => (b.total_ventas ?? 0) - (a.total_ventas ?? 0) || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }, [clientes]);

  const sugeridosCliente = useMemo(() => {
    const consumidorFinal = clientes.filter((c) => c.es_consumidor_final);
    const resto = clientesDestacados.filter((c) => !c.es_consumidor_final);
    return [...consumidorFinal, ...resto].slice(0, 6);
  }, [clientes, clientesDestacados]);

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

  function factorDeLinea(ln: LineaVenta): number {
    return factorDeLineaBase(ln, presentacionesPorProducto);
  }

  function descuentoDeLinea(ln: LineaVenta): { bruto: number; monto: number; porcentaje: number; neto: number } {
    const q = Number(ln.cantidad) * factorDeLinea(ln);
    const pu = Number(ln.precio_unitario_venta);
    if (!(q > 0) || !(pu >= 0) || Number.isNaN(q) || Number.isNaN(pu)) {
      return { bruto: 0, monto: 0, porcentaje: 0, neto: 0 };
    }
    const bruto = Math.round(q * pu * 100) / 100;
    const mejor = elegirMejorDescuento(q, bruto, descuentosAplicables);
    const monto = mejor ? mejor.monto : 0;
    return {
      bruto,
      monto,
      porcentaje: mejor ? mejor.porcentaje : 0,
      neto: Math.round((bruto - monto) * 100) / 100,
    };
  }

  const descuentoBorrador = useMemo(() => {
    let d = 0;
    for (const ln of lineas) d += descuentoDeLinea(ln).monto;
    return Math.round(d * 100) / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, presentacionesPorProducto, descuentosAplicables]);

  const totalBrutoBorrador = useMemo(() => {
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

  const totalBorrador = useMemo(
    () => Math.round((totalBrutoBorrador - descuentoBorrador) * 100) / 100,
    [totalBrutoBorrador, descuentoBorrador]
  );

  const fechaFacturaEfectiva = otraFechaFactura && fechaFactura ? fechaFactura : hoyLocalISO();
  const errorCredito = useMemo(() => {
    if (condicionPago !== "CREDITO") return null;
    if (otraFechaFactura && !fechaFactura) return "Elige la fecha de la factura";
    if (tipoDocumentoCredito === "FACTURA_CAMBIARIA") {
      const nit = (clienteSeleccionado?.nit_cliente || "").trim();
      if (!nit || nit.toUpperCase() === "CF") {
        return "La factura cambiaria requiere que el cliente tenga un NIT registrado";
      }
      if (!(clienteSeleccionado?.direccion || "").trim()) {
        return "La factura cambiaria requiere que el cliente tenga una dirección registrada";
      }
    }
    return validarCondicionesCredito(Number(plazoDias), Number(numeroCuotas));
  }, [
    condicionPago,
    otraFechaFactura,
    fechaFactura,
    tipoDocumentoCredito,
    clienteSeleccionado,
    plazoDias,
    numeroCuotas,
  ]);

  const planCuotas = useMemo(() => {
    if (condicionPago !== "CREDITO" || errorCredito || totalBorrador <= 0) return [];
    try {
      return generarCuotas(fechaFacturaEfectiva, Number(plazoDias), Number(numeroCuotas), totalBorrador);
    } catch {
      return [];
    }
  }, [condicionPago, errorCredito, totalBorrador, fechaFacturaEfectiva, plazoDias, numeroCuotas]);

  function precioSugerido(p: Producto | undefined): string {
    if (!p) return "";
    const v = tipoVenta === "MAYORISTA" ? Number(p.precio_mayoreo) : Number(p.precio_unitario);
    if (Number.isNaN(v)) return "";
    return String(v);
  }

  function actualizarLinea(key: string, patch: Partial<LineaVenta>) {
    setLineas((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    setError(null);
    setOkMsg(null);
  }

  function onProductoChange(key: string, idStr: string) {
    const id = Number(idStr);
    const p = productoPorId.get(id);
    setLineas((prev) => prev.map((ln) => ln.key === key
      ? { ...ln, id_producto: idStr, id_presentacion: "", precio_unitario_venta: p ? precioSugerido(p) : ln.precio_unitario_venta }
      : ln));
    if (id) cargarPresentacionesSiFalta(id);
    setError(null);
    setOkMsg(null);
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
    setError(null);
    setOkMsg(null);
    const clienteElegido = clientes.find((c) => String(c.id_cliente) === idStr);
    if (clienteElegido?.es_consumidor_final) {
      setCondicionPago("CONTADO");
      setOtraFechaFactura(false);
      setFechaFactura("");
      setPlazoDias("30");
      setNumeroCuotas("1");
      setTipoDocumentoCredito("FACTURA");
    }
    if (!forzarTipoVenta) {
      const detectado = clienteElegido?.tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";
      setTipoVenta(detectado);
      aplicarPreciosPorTipo(detectado);
    }
  }

  function seleccionarCliente(c: Cliente) {
    onClienteChange(String(c.id_cliente));
    if (c.direccion) setDireccionEntrega(c.direccion);
  }

  function limpiarClienteSeleccionado() {
    setAvisoCliente(null);
    onClienteChange("");
  }

  function onForzarTipoVentaChange(activar: boolean) {
    setForzarTipoVenta(activar);
    if (!activar) {
      const detectado = clienteSeleccionado?.tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";
      setTipoVenta(detectado);
      aplicarPreciosPorTipo(detectado);
    }
  }

  function onClienteCreado(nuevo: ClienteCreado) {
    setClientes((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setIdCliente(String(nuevo.id_cliente));
    if (nuevo.direccion) setDireccionEntrega(nuevo.direccion);
    if (!forzarTipoVenta) {
      const detectado = nuevo.tipo_cliente === "MAYORISTA" ? "MAYORISTA" : "MINORISTA";
      setTipoVenta(detectado);
      aplicarPreciosPorTipo(detectado);
    }
    setError(null);
    setAvisoCliente(
      `Cliente "${nuevo.nombre}" creado y seleccionado ✓${
        nuevo.codigo_cliente ? ` · código ${nuevo.codigo_cliente}` : ""
      }`
    );
    setCreandoCliente(false);
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea()]);
  }

  function quitarLinea(key: string) {
    setLineas((prev) => prev.length <= 1 ? prev : prev.filter((x) => x.key !== key));
  }

  async function handleSubmit() {
    setLoadingSubmit(true);
    setError(null);
    setOkMsg(null);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cliente: Number(idCliente),
          condicion_pago: condicionPago,
          credito: condicionPago === "CREDITO"
            ? { fecha_factura: fechaFacturaEfectiva, plazo_dias: Number(plazoDias), numero_cuotas: Number(numeroCuotas), tipo_documento: tipoDocumentoCredito }
            : undefined,
          tipo_venta: tipoVenta,
          forzar_tipo_venta: forzarTipoVenta,
          tipo_entrega: tipoEntrega,
          direccion_entrega: tipoEntrega === "DOMICILIO" ? direccionEntrega.trim() : undefined,
          lineas: lineasPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo registrar la venta");
        return;
      }
      if (data.credito) {
        setOkMsg(`Venta #${data.id_venta} a crédito registrada. Total: Q${Number(data.total).toFixed(2)} · ${etiquetaTipoDocumento(data.credito.tipo_documento || "FACTURA")} ${data.credito.numero_factura}${data.id_orden ? ` · Pedido de entrega #${data.id_orden}` : ""}`);
        setCreditoGenerado({
          numero_factura: data.credito.numero_factura,
          tipo_documento: data.credito.tipo_documento,
          fecha_limite_pago: data.credito.fecha_limite_pago,
          bloqueado: !!data.credito.alerta?.bloqueado,
        });
      } else {
        setOkMsg(`Venta #${data.id_venta} registrada. Total: Q${Number(data.total).toFixed(2)}${data.id_orden ? ` · Pedido de entrega #${data.id_orden}` : ""}`);
        setCreditoGenerado(null);
      }
      setVentaDeshacer({ id: data.id_venta, total: Number(data.total) });
      setSegundosRestantes(VENTANA_DESHACER_SEGUNDOS);
      setIdCliente("");
      setCondicionPago("CONTADO");
      setOtraFechaFactura(false);
      setFechaFactura("");
      setPlazoDias("30");
      setNumeroCuotas("1");
      setTipoDocumentoCredito("FACTURA");
      setTipoVenta("MINORISTA");
      setForzarTipoVenta(false);
      setTipoEntrega("EN_TIENDA");
      setDireccionEntrega("");
      setLineas([nuevaLinea()]);
      await cargarVentas();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoadingSubmit(false);
      setConfirmando(false);
    }
  }

  async function handleDeshacer() {
    if (!ventaDeshacer) return;
    setDeshaciendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventas/${ventaDeshacer.id}/anular`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo deshacer la venta");
        return;
      }
      setOkMsg(null);
      setVentaDeshacer(null);
      await cargarVentas();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setDeshaciendo(false);
    }
  }

  const puedeEnviar = Boolean(
    idCliente &&
    lineas.some((ln) => ln.id_producto && ln.id_bodega && ln.cantidad && Number(ln.cantidad) > 0) &&
    (tipoEntrega === "EN_TIENDA" || direccionEntrega.trim().length > 0) &&
    (condicionPago === "CONTADO" || (!errorCredito && totalBorrador > 0))
  );

  return {
    usuario,
    clientes,
    productosActivos,
    bodegas,
    ventas,
    loadingLista,
    loadingSubmit,
    error,
    okMsg,
    confirmando,
    setConfirmando,
    ventaDeshacer,
    segundosRestantes,
    deshaciendo,
    idCliente,
    setCreandoCliente,
    creandoCliente,
    avisoCliente,
    condicionPago,
    setCondicionPago,
    otraFechaFactura,
    setOtraFechaFactura,
    fechaFactura,
    setFechaFactura,
    plazoDias,
    setPlazoDias,
    numeroCuotas,
    setNumeroCuotas,
    tipoDocumentoCredito,
    setTipoDocumentoCredito,
    creditoGenerado,
    tipoVenta,
    setTipoVenta,
    forzarTipoVenta,
    onForzarTipoVentaChange,
    tipoEntrega,
    setTipoEntrega,
    direccionEntrega,
    setDireccionEntrega,
    lineas,
    presentacionesPorProducto,
    clienteSeleccionado,
    sugeridosCliente,
    productoPorId,
    stockDisponible,
    factorDeLinea,
    descuentoDeLinea,
    descuentoBorrador,
    totalBrutoBorrador,
    totalBorrador,
    fechaFacturaEfectiva,
    errorCredito,
    planCuotas,
    actualizarLinea,
    onProductoChange,
    aplicarPreciosPorTipo,
    onClienteChange,
    seleccionarCliente,
    limpiarClienteSeleccionado,
    onClienteCreado,
    agregarLinea,
    quitarLinea,
    handleSubmit,
    handleDeshacer,
    puedeEnviar,
  };
}

export type VentasController = ReturnType<typeof useVentas>;
