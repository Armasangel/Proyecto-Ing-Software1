"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/hooks/useStaffSession";
import { HISTORIAL_VENTAS_DEFAULT_LIMIT } from "@/lib/historial-ventas";
import { TIPOS_USUARIO } from "@/lib/roles";
import { buildHistorialParams, num } from "@/lib/historial-ventas-utils";
import type { ClienteOpt, Pagination, PickerTipo, ProductoOpt, ProveedorOpt, VentaHistorial } from "@/lib/types/historial-ventas";

export function useHistorialVentas() {
  const router = useRouter();
  const usuario = useStaffSession();

  const [ventas, setVentas] = useState<VentaHistorial[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [panelFiltros, setPanelFiltros] = useState(false);

  const [periodo, setPeriodo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [idProducto, setIdProducto] = useState<number | null>(null);
  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [idProveedor, setIdProveedor] = useState<number | null>(null);
  const [minTotal, setMinTotal] = useState<number | null>(null);
  const [maxTotal, setMaxTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  const [productosCat, setProductosCat] = useState<ProductoOpt[]>([]);
  const [clientesCat, setClientesCat] = useState<ClienteOpt[]>([]);
  const [proveedoresCat, setProveedoresCat] = useState<ProveedorOpt[]>([]);

  const [picker, setPicker] = useState<PickerTipo>(null);
  const [pickerBusqueda, setPickerBusqueda] = useState("");

  const prevStructuralRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) return;
    Promise.all([
      fetch("/api/productos").then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/proveedores").then((r) => r.json()),
    ])
      .then(([dp, dc, dpr]) => {
        setProductosCat(dp.productos || []);
        setClientesCat(dc.clientes || []);
        setProveedoresCat(dpr.proveedores || []);
      })
      .catch(() => {});
  }, [usuario]);

  const structuralKey = useMemo(
    () =>
      `${debouncedQ}|${periodo}|${fechaDesde}|${fechaHasta}|${idProducto ?? ""}|${idCliente ?? ""}|${idProveedor ?? ""}`,
    [debouncedQ, periodo, fechaDesde, fechaHasta, idProducto, idCliente, idProveedor]
  );

  const fetchHistorial = useCallback(
    async (opts: {
      offset: number;
      includeMeta: boolean;
      skipAmountFilter?: boolean;
    }) => {
      const params = buildHistorialParams({
        q: debouncedQ,
        periodo,
        fechaDesde,
        fechaHasta,
        idProducto,
        idCliente,
        idProveedor,
        minTotal,
        maxTotal,
        skipAmountFilter: opts.skipAmountFilter,
        limit: HISTORIAL_VENTAS_DEFAULT_LIMIT,
        offset: opts.offset,
        metaTotales: opts.includeMeta,
      });
      const res = await fetch(`/api/historial-ventas?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cargar historial");
      }
      return data as {
        ventas: VentaHistorial[];
        pagination: Pagination;
        totales?: { min_total: string | number; max_total: string | number };
      };
    },
    [debouncedQ, periodo, fechaDesde, fechaHasta, idProducto, idCliente, idProveedor, minTotal, maxTotal]
  );

  useEffect(() => {
    if (!usuario) return;
    if (usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
      router.replace("/dashboard");
      return;
    }

    const structuralChanged = prevStructuralRef.current !== structuralKey;
    if (structuralChanged && offset !== 0) {
      setOffset(0);
      return;
    }
    if (structuralChanged) {
      prevStructuralRef.current = structuralKey;
    }

    let cancelled = false;
    setCargando(true);
    setError("");

    const includeMeta = structuralChanged;
    const fetchOffset = offset;

    fetchHistorial({
      offset: fetchOffset,
      includeMeta,
      skipAmountFilter: structuralChanged,
    })
      .then((data) => {
        if (cancelled) return;
        const rows = data.ventas || [];
        if (fetchOffset === 0) {
          setVentas(rows);
        } else {
          setVentas((prev) => {
            const seen = new Set(prev.map((v) => v.id_venta));
            const extra = rows.filter((v) => !seen.has(v.id_venta));
            return [...prev, ...extra];
          });
        }
        setPagination(data.pagination);
        if (data.totales && structuralChanged) {
          const mn = num(data.totales.min_total);
          const mx = num(data.totales.max_total);
          setMinTotal(mn);
          setMaxTotal(mx >= mn ? mx : mn);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Error");
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usuario, router, structuralKey, offset, fetchHistorial]);

  const sliderMinBound = 0;
  const rangosMontosListos = minTotal != null && maxTotal != null;
  const sliderMaxBound = useMemo(() => {
    if (!rangosMontosListos) return 1;
    const hi = maxTotal as number;
    const lo = minTotal as number;
    if (hi > lo) return Math.ceil(hi);
    return Math.max(1, Math.ceil(hi));
  }, [rangosMontosListos, minTotal, maxTotal]);

  const onMinSlider = (v: number) => {
    setOffset(0);
    const hi = maxTotal ?? sliderMaxBound;
    setMinTotal(Math.min(v, hi));
  };

  const onMaxSlider = (v: number) => {
    setOffset(0);
    const lo = minTotal ?? 0;
    setMaxTotal(Math.max(v, lo));
  };

  const nombreProductoSel = productosCat.find((p) => p.id_producto === idProducto);
  const nombreClienteSel = clientesCat.find((c) => c.id_cliente === idCliente);
  const nombreProveedorSel = proveedoresCat.find((p) => p.id_proveedor === idProveedor);

  const productosPickerFiltrados = useMemo(() => {
    const q = pickerBusqueda.trim().toLowerCase();
    if (!q) return productosCat;
    return productosCat.filter(
      (p) => p.nombre_producto.toLowerCase().includes(q) || p.codigo_producto.toLowerCase().includes(q)
    );
  }, [productosCat, pickerBusqueda]);

  const clientesPickerFiltrados = useMemo(() => {
    const { filtrarClientesPorTexto } = require("@/lib/clientes-busqueda");
    if (!pickerBusqueda.trim()) return clientesCat;
    return filtrarClientesPorTexto(clientesCat, pickerBusqueda);
  }, [clientesCat, pickerBusqueda]);

  const proveedoresPickerFiltrados = useMemo(() => {
    const q = pickerBusqueda.trim().toLowerCase();
    if (!q) return proveedoresCat;
    return proveedoresCat.filter(
      (p) => p.nombre_proveedor.toLowerCase().includes(q) || p.nit_proveedor.toLowerCase().includes(q)
    );
  }, [proveedoresCat, pickerBusqueda]);

  return {
    usuario,
    router,
    ventas,
    pagination,
    cargando,
    error,
    busqueda,
    setBusqueda,
    panelFiltros,
    setPanelFiltros,
    periodo,
    setPeriodo,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    idProducto,
    setIdProducto,
    idCliente,
    setIdCliente,
    idProveedor,
    setIdProveedor,
    offset,
    setOffset,
    minTotal,
    maxTotal,
    sliderMinBound,
    sliderMaxBound,
    rangosMontosListos,
    onMinSlider,
    onMaxSlider,
    nombreProductoSel,
    nombreClienteSel,
    nombreProveedorSel,
    picker,
    setPicker,
    pickerBusqueda,
    setPickerBusqueda,
    productosPickerFiltrados,
    clientesPickerFiltrados,
    proveedoresPickerFiltrados,
  };
}

export type HistorialVentasController = ReturnType<typeof useHistorialVentas>;
