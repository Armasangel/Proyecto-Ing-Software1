"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBodegueroSession } from "@/hooks/useBodegueroSession";
import { PEDIDOS_POLL_MS } from "@/lib/constants/bodega";
import type {
  BodegaSimple,
  MensajeBodega,
  Movimiento,
  Pedido,
  Presentacion,
  Producto,
  TabKey,
} from "@/lib/types/bodega";

export function useBodega() {
  const usuario = useBodegueroSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("pedidos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [avanzandoId, setAvanzandoId] = useState<number | null>(null);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegasDestino, setBodegasDestino] = useState<BodegaSimple[]>([]);
  const [nombreBodegaPropia, setNombreBodegaPropia] = useState<string>("");
  const [historial, setHistorial] = useState<Movimiento[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);

  const [idProducto, setIdProducto] = useState("");
  const [idPresentacion, setIdPresentacion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [productosSugeridos, setProductosSugeridos] = useState<Producto[]>([]);
  const [versionSugeridos, setVersionSugeridos] = useState(0);
  const [idBodegaDestino, setIdBodegaDestino] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<MensajeBodega | null>(null);

  const cargarHistorial = useCallback(() => {
    fetch("/api/bodega/historial")
      .then((r) => r.json())
      .then((d) => setHistorial(d.movimientos || []))
      .catch(() => {});
  }, []);

  const cargarPedidos = useCallback(() => {
    fetch("/api/bodega/pedidos")
      .then((r) => r.json())
      .then((d) => {
        if (d.pedidos) {
          setPedidos(d.pedidos);
          setPedidosError(null);
        } else if (d.error) {
          setPedidosError(d.error);
        }
      })
      .catch(() => setPedidosError("No se pudo cargar el tablero de pedidos"));
  }, []);

  useEffect(() => {
    if (!usuario || tab !== "pedidos") return;
    cargarPedidos();
    const interval = setInterval(cargarPedidos, PEDIDOS_POLL_MS);
    return () => clearInterval(interval);
  }, [usuario, tab, cargarPedidos]);

  const avanzarPedido = async (idOrden: number, siguienteEstado: string) => {
    setAvanzandoId(idOrden);
    setPedidosError(null);
    try {
      const r = await fetch(`/api/ordenes/${idOrden}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: siguienteEstado }),
      });
      const d = await r.json();
      if (!r.ok) {
        setPedidosError(d.error || "No se pudo actualizar el pedido");
      } else {
        cargarPedidos();
      }
    } catch {
      setPedidosError("Error de conexión");
    } finally {
      setAvanzandoId(null);
    }
  };

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/productos")
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []))
      .catch(() => {});
    fetch("/api/bodegas/simple")
      .then((r) => r.json())
      .then((d) => {
        const todas: BodegaSimple[] = d.bodegas || [];
        setBodegasDestino(todas.filter((b) => b.id_bodega !== usuario.id_bodega));
        setNombreBodegaPropia(todas.find((b) => b.id_bodega === usuario.id_bodega)?.nombre_bodega || "");
      })
      .catch(() => {});
    cargarHistorial();
  }, [usuario, cargarHistorial]);

  useEffect(() => {
    if (!usuario || tab === "pedidos") return;
    const soloConStock = tab === "salida" || tab === "traslado";
    fetch(`/api/productos/frecuentes?limit=5${soloConStock ? "&con_stock=1" : ""}`)
      .then((r) => r.json())
      .then((d) => setProductosSugeridos(d.productos || []))
      .catch(() => setProductosSugeridos([]));
  }, [usuario, tab, versionSugeridos]);

  useEffect(() => {
    setIdPresentacion("");
    if (!idProducto) {
      setPresentaciones([]);
      return;
    }
    fetch(`/api/presentaciones?id_producto=${idProducto}`)
      .then((r) => r.json())
      .then((d) => setPresentaciones(d.presentaciones || []))
      .catch(() => setPresentaciones([]));
  }, [idProducto]);

  function cambiarTab(nuevo: TabKey) {
    setTab(nuevo);
    setMensaje(null);
  }

  function limpiarFormulario() {
    setIdProducto("");
    setIdPresentacion("");
    setCantidad("");
    setDescripcion("");
    setIdBodegaDestino("");
  }

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  };

  const enviar = async () => {
    setMensaje(null);
    if (!idProducto || !cantidad || Number(cantidad) <= 0) {
      setMensaje({ texto: "Selecciona un producto y una cantidad válida", tipo: "err" });
      return;
    }
    if (tab === "traslado" && !idBodegaDestino) {
      setMensaje({ texto: "Selecciona la bodega destino", tipo: "err" });
      return;
    }

    setEnviando(true);
    try {
      let url = "";
      let body: Record<string, unknown> = {
        id_producto: Number(idProducto),
      };

      if (idPresentacion) {
        body.id_presentacion = Number(idPresentacion);
        body.cantidad_presentacion = Number(cantidad);
      } else {
        body.cantidad = Number(cantidad);
      }

      if (tab === "entrada") {
        url = "/api/inventario/entrada";
        body.tipo_ingreso = "UNIDADES";
        body.descripcion = descripcion || undefined;
      } else if (tab === "salida") {
        url = "/api/inventario/salida";
        body.motivo = "MERMA";
        body.descripcion = descripcion || undefined;
      } else {
        url = "/api/gestion-inventario/transferencia";
        body = {
          id_bodega_destino: Number(idBodegaDestino),
          id_producto: Number(idProducto),
          cantidad: idPresentacion
            ? Number(cantidad) *
              Number(presentaciones.find((p) => p.id_presentacion === Number(idPresentacion))?.factor_conversion || 1)
            : Number(cantidad),
          descripcion: descripcion || undefined,
        };
      }

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setMensaje({ texto: d.error || "No se pudo registrar el movimiento", tipo: "err" });
      } else {
        setMensaje({ texto: "Movimiento registrado ✓", tipo: "ok" });
        limpiarFormulario();
        cargarHistorial();
        setVersionSugeridos((v) => v + 1);
      }
    } catch {
      setMensaje({ texto: "Error de conexión", tipo: "err" });
    } finally {
      setEnviando(false);
    }
  };

  return {
    usuario,
    tab,
    cambiarTab,
    pedidos,
    avanzandoId,
    pedidosError,
    avanzarPedido,
    productos,
    bodegasDestino,
    nombreBodegaPropia,
    historial,
    presentaciones,
    idProducto,
    setIdProducto,
    idPresentacion,
    setIdPresentacion,
    cantidad,
    setCantidad,
    productosSugeridos,
    idBodegaDestino,
    setIdBodegaDestino,
    descripcion,
    setDescripcion,
    enviando,
    mensaje,
    handleLogout,
    enviar,
  };
}
