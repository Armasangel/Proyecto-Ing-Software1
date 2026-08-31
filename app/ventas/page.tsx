"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/hooks/useStaffSession";
import { TIPOS_USUARIO } from "@/lib/roles";
import { Icon } from "@/components/Icon";

type Cliente = {
  id_cliente: number;
  nombre: string;
  correo: string;
  tipo_cliente: string;
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

type LineaVenta = {
  key: string;
  id_producto: string;
  id_bodega: string;
  cantidad: string;
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
  nombre_cliente: string;
  correo_cliente: string;
  nombre_colaborador: string | null;
  productos: ProductoVentaRow[];
};

const ESTADOS = [
  { value: "PAGADO", label: "Pagado" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "ENTREGADO", label: "Entregado" },
] as const;

const inputCls =
  "w-full px-3 py-2.5 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-[0.95rem] outline-none focus:ring-2 focus:ring-market/40 transition-shadow";
const labelCls = "font-semibold text-[0.88rem] text-ink-muted";

function nuevaLinea(): LineaVenta {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id_producto: "",
    id_bodega: "",
    cantidad: "",
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

  const [idCliente, setIdCliente] = useState("");
  const [estadoPago, setEstadoPago] = useState<string>("PAGADO");
  const [tipoVenta, setTipoVenta] = useState<string>("MINORISTA");
  const [tipoEntrega, setTipoEntrega] = useState<string>("EN_TIENDA");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [fechaLimitePago, setFechaLimitePago] = useState("");
  const [lineas, setLineas] = useState<LineaVenta[]>([nuevaLinea()]);

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
    if (usuario.tipo_usuario === TIPOS_USUARIO.DUENO) {
      router.replace("/dashboard");
      return;
    }
    if (usuario.tipo_usuario !== TIPOS_USUARIO.EMPLEADO) return;
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
    if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.EMPLEADO) return;
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

  const productoPorId = useMemo(() => {
    const m = new Map<number, Producto>();
    productos.forEach((p) => m.set(p.id_producto, p));
    return m;
  }, [productos]);

  const stockDisponible = useCallback((idProducto: string, idBodega: string): number => {
    const idP = Number(idProducto);
    const idB = Number(idBodega);
    if (!idP || !idB) return 0;
    const row = stock.find((s) => s.id_producto === idP && s.id_bodega === idB);
    return row ? Number(row.cantidad_disponible) : 0;
  }, [stock]);

  const totalBorrador = useMemo(() => {
    let t = 0;
    for (const ln of lineas) {
      const q = Number(ln.cantidad);
      const pu = Number(ln.precio_unitario_venta);
      if (q > 0 && pu >= 0 && !Number.isNaN(q) && !Number.isNaN(pu)) {
        t += Math.round(q * pu * 100) / 100;
      }
    }
    return Math.round(t * 100) / 100;
  }, [lineas]);

  if (!usuario) return <p className="p-8 text-ink-muted">Cargando…</p>;
  if (usuario.tipo_usuario !== TIPOS_USUARIO.EMPLEADO) return <p className="p-8 text-ink-muted">Redirigiendo…</p>;

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
    setLineas((prev) => prev.map((ln) => ln.key === key ? { ...ln, id_producto: idStr, precio_unitario_venta: p ? precioSugerido(p) : ln.precio_unitario_venta } : ln));
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

  async function handleSubmit() {
    setLoadingSubmit(true); setError(null); setOkMsg(null);
    try {
      const lineasPayload = lineas
        .filter((ln) => ln.id_producto && ln.id_bodega && ln.cantidad && ln.precio_unitario_venta)
        .map((ln) => ({ id_producto: Number(ln.id_producto), id_bodega: Number(ln.id_bodega), cantidad: Number(ln.cantidad), precio_unitario_venta: Number(ln.precio_unitario_venta) }));
      const res = await fetch("/api/ventas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_cliente: Number(idCliente), estado_pago: estadoPago, tipo_venta: tipoVenta, tipo_entrega: tipoEntrega, direccion_entrega: tipoEntrega === "DOMICILIO" ? direccionEntrega.trim() : undefined, fecha_limite_pago: fechaLimitePago || undefined, lineas: lineasPayload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo registrar la venta"); return; }
      setOkMsg(`Venta #${data.id_venta} registrada. Total: Q${Number(data.total).toFixed(2)}`);
      setIdCliente(""); setEstadoPago("PAGADO"); setTipoVenta("MINORISTA"); setTipoEntrega("EN_TIENDA");
      setDireccionEntrega(""); setFechaLimitePago(""); setLineas([nuevaLinea()]);
      await cargarVentas();
    } catch { setError("No se pudo conectar con el servidor"); }
    finally { setLoadingSubmit(false); }
  }

  const puedeEnviar = idCliente && lineas.some((ln) => ln.id_producto && ln.id_bodega && ln.cantidad && Number(ln.cantidad) > 0) && (tipoEntrega === "EN_TIENDA" || direccionEntrega.trim().length > 0);

  return (
    <StaffShell usuario={usuario} title="Ventas" subtitle="Registro de ventas y control de transacciones (colaborador)">
      <div className="flex flex-col gap-8">
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
              <select value={idCliente} onChange={(e) => { setIdCliente(e.target.value); setError(null); setOkMsg(null); }} className={inputCls}>
                <option value="">— Selecciona un cliente —</option>
                {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} ({c.correo})</option>)}
              </select>
            </div>

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                <label className={labelCls}>Estado de pago *</label>
                <select value={estadoPago} onChange={(e) => { setEstadoPago(e.target.value); setError(null); }} className={inputCls}>
                  {ESTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="text-[0.78rem] text-ink-muted">En base de datos: <code>estado_venta</code></span>
              </div>
              <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                <label className={labelCls}>Tipo de venta *</label>
                <select value={tipoVenta} onChange={(e) => { const v = e.target.value; setTipoVenta(v); aplicarPreciosPorTipo(v); setError(null); }} className={inputCls}>
                  <option value="MINORISTA">Minorista</option>
                  <option value="MAYORISTA">Mayorista</option>
                </select>
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

            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Fecha límite de pago (opcional)</label>
              <input type="date" value={fechaLimitePago} onChange={(e) => setFechaLimitePago(e.target.value)} className={inputCls} />
            </div>

            <div className="mt-2">
              <div className="font-semibold text-[0.9rem] mb-3 text-ink">Productos</div>
              <div className="flex flex-col gap-3">
                {lineas.map((ln) => {
                  const pSel = ln.id_producto ? productoPorId.get(Number(ln.id_producto)) : undefined;
                  const disponible = stockDisponible(ln.id_producto, ln.id_bodega);
                  return (
                    <div key={ln.key} className="grid gap-2 items-end" style={{ gridTemplateColumns: "1fr 140px 100px 120px auto" }}>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Producto</label>
                        <select value={ln.id_producto} onChange={(e) => onProductoChange(ln.key, e.target.value)} className={inputCls}>
                          <option value="">— Producto —</option>
                          {productos.filter((p) => p.estado_producto).map((p) => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Bodega *</label>
                        <select value={ln.id_bodega} onChange={(e) => { actualizarLinea(ln.key, { id_bodega: e.target.value }); setError(null); setOkMsg(null); }} className={inputCls}>
                          <option value="">— Bodega —</option>
                          {bodegas.map((b) => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Cantidad</label>
                        <input type="number" min="0.001" step="0.001" value={ln.cantidad} onChange={(e) => actualizarLinea(ln.key, { cantidad: e.target.value })} className={inputCls} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>P. venta</label>
                        <input type="number" min="0" step="0.01" value={ln.precio_unitario_venta} onChange={(e) => actualizarLinea(ln.key, { precio_unitario_venta: e.target.value })} className={inputCls} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLineas((prev) => prev.length <= 1 ? prev : prev.filter((x) => x.key !== ln.key))}
                        disabled={lineas.length <= 1}
                        title="Quitar línea"
                        className="h-10 w-10 flex items-center justify-center rounded-control border border-[var(--border)] bg-cream/60 text-ink-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-achiote-50 enabled:hover:text-achiote-600"
                      >
                        <Icon name="close" variant="dark" size={14} />
                      </button>
                      {pSel && (
                        <span className="col-span-full text-[0.78rem] text-ink-muted">
                          Unidad: {pSel.unidad_medida}
                          {ln.id_bodega && (
                            <> · Disponible en bodega: <strong className={disponible > 0 ? "text-market-600" : "text-achiote-600"}>{disponible}</strong></>
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
                onClick={handleSubmit}
                disabled={loadingSubmit || !puedeEnviar}
                className="bg-market text-white border-none rounded-control px-6 py-3.5 text-base font-semibold transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingSubmit ? "Guardando…" : "Registrar venta"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-achiote-50 border border-achiote/30 rounded-control px-4 py-3 text-achiote-600">
              {error}
            </div>
          )}
          {okMsg && (
            <div key={okMsg} className="mt-4 bg-market-50 border border-market/35 rounded-control px-4 py-3 text-market-600 font-medium flex items-center gap-2 animate-stamp">
              <span className="inline-flex w-5 h-5 rounded-full bg-market text-white items-center justify-center text-xs shrink-0">✓</span>
              {okMsg}
            </div>
          )}
        </div>

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
                      <td className="px-3.5 py-2.5 text-[0.88rem] text-ink border-b border-[var(--border)]">{v.estado_venta}</td>
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
