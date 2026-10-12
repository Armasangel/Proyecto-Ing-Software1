import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { matchesQuery, paginar, PaginationBar, PAGE_SIZES_COMPACT, type PageSize } from "@/lib/ui-table";

const MIS_ITEMS = [
  {label: "editar", icon: "pencil"},
  {label: "borar", icon: "trash"},
  {label: "stock", icon: "box"},
  {label: "transferencia", icon: "transfer"},
  {label: "ajuste", icon: "setting"}
]


// ─── Tipos ────────────────────────────────────────────────────────────────────

type Bodega = {
  id_bodega: number;
  nombre_bodega: string;
  ubicacion: string | null;
  total_productos: number;
  stock_total: string | number;
};

type Producto = {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
  estado_producto: boolean;
};

type StockRow = {
  id_bodega: number;
  nombre_bodega: string;
  ubicacion: string | null;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
  estado_producto: boolean;
  nombre_categoria: string;
  nombre_marca: string;
  cantidad_disponible: string | number;
  stock_minimo: string | number;
  ultima_actualizacion: string;
  bajo_minimo: boolean;
};

type KardexRow = {
  id_kardex: number;
  fecha_movimiento: string;
  tipo_movimiento: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: string | number;
  descripcion: string | null;
  id_bodega: number;
  nombre_bodega: string;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  unidad_medida: string;
};

type StockActualizado = {
  nombre_producto: string;
  nombre_bodega: string;
  cantidad_disponible: number;
  unidad_medida: string;
  ultima_actualizacion: string;
};

export type InventarioTab = "stock" | "operaciones" | "kardex" | "bodegas" | "presentaciones";

const EMPTY_BODEGA_FORM = { nombre_bodega: "", ubicacion: "" };

// ─── Componente ───────────────────────────────────────────────────────────────

export function InventarioView({ tab }: { tab: InventarioTab }) {
  // Maestros
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [bodegasSimple, setBodegasSimple] = useState<{ id_bodega: number; nombre_bodega: string }[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Filtros comunes
  const [filtroBodega, setFiltroBodega] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  // Presentaciones (conversión de unidades para bodega)
  const [presProductoId, setPresProductoId] = useState("");
  const [presProductoQuery, setPresProductoQuery] = useState("");
  const [presSugerenciasAbiertas, setPresSugerenciasAbiertas] = useState(false);
  const [presLista, setPresLista] = useState<{ id_presentacion: number; nombre_presentacion: string; factor_conversion: string }[]>([]);
  const [presNombre, setPresNombre] = useState("");
  const [presFactor, setPresFactor] = useState("");
  const [presError, setPresError] = useState("");
  const [presGuardando, setPresGuardando] = useState(false);

  // Búsqueda (independiente por pestaña)
  const [qStock, setQStock] = useState("");
  const [qKardex, setQKardex] = useState("");
  const [qBodegas, setQBodegas] = useState("");

  // Paginación
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(10);

  // Stock
  const [stock, setStock] = useState<StockRow[]>([]);
  const [resumen, setResumen] = useState<{ filas: number; bajo_minimo: number } | null>(null);
  const [minEdits, setMinEdits] = useState<Record<string, string>>({});

  // Kardex
  const [kardex, setKardex] = useState<KardexRow[]>([]);

  // Operaciones: Entrada
  const [entradaForm, setEntradaForm] = useState({ id_bodega: "", id_producto: "", id_presentacion: "", cantidad: "", tipo_ingreso: "UNIDADES", descripcion: "" });
  const [entradaLoading, setEntradaLoading] = useState(false);
  const [entradaResultado, setEntradaResultado] = useState<StockActualizado | null>(null);
  const [entradaError, setEntradaError] = useState<string | null>(null);
  // Presentaciones disponibles para el producto elegido en "Entrada de stock"
  // (ej. "Caja de 24"). Si el usuario elige una, la cantidad que escribe está
  // en esa presentación y el backend la convierte a unidad base usando el
  // factor_conversion real — antes esto no pasaba y "Cajas" solo sumaba 1.
  const [entradaPresentaciones, setEntradaPresentaciones] = useState<{ id_presentacion: number; nombre_presentacion: string; factor_conversion: string }[]>([]);

  // Operaciones: Transferencia
  const [xfer, setXfer] = useState({ id_bodega_origen: "", id_bodega_destino: "", id_producto: "", cantidad: "", descripcion: "" });

  // Operaciones: Ajuste
  const [adj, setAdj] = useState({ id_bodega: "", id_producto: "", nueva_cantidad: "", descripcion: "" });

  // Bodegas CRUD
  const [modalBodegaOpen, setModalBodegaOpen] = useState(false);
  const [editandoBodega, setEditandoBodega] = useState<Bodega | null>(null);
  const [bodegaForm, setBodegaForm] = useState({ ...EMPTY_BODEGA_FORM });
  const [savingBodega, setSavingBodega] = useState(false);
  const [bodegaFormError, setBodegaFormError] = useState("");
  const [confirmDeleteBodega, setConfirmDeleteBodega] = useState<number | null>(null);
  const [deletingBodega, setDeletingBodega] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Queries ────────────────────────────────────────────────────────────────

  const stockQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (filtroBodega) p.set("id_bodega", filtroBodega);
    if (filtroProducto) p.set("id_producto", filtroProducto);
    if (soloBajoMinimo) p.set("solo_bajo_minimo", "1");
    if (incluirInactivos) p.set("incluir_inactivos", "1");
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [filtroBodega, filtroProducto, soloBajoMinimo, incluirInactivos]);

  const kardexQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (filtroBodega) p.set("id_bodega", filtroBodega);
    if (filtroProducto) p.set("id_producto", filtroProducto);
    p.set("limit", "500");
    return `?${p.toString()}`;
  }, [filtroBodega, filtroProducto]);

  // ── Carga de datos ─────────────────────────────────────────────────────────

  const cargarBodegas = useCallback(async () => {
    const r = await fetch("/api/bodegas");
    const d = await r.json();
    if (r.ok) {
      setBodegas(d.bodegas || []);
      setBodegasSimple((d.bodegas || []).map((b: Bodega) => ({ id_bodega: b.id_bodega, nombre_bodega: b.nombre_bodega })));
    }
  }, []);

  const cargarProductos = useCallback(async () => {
    const r = await fetch("/api/productos");
    const d = await r.json();
    if (r.ok) setProductos(d.productos || []);
  }, []);

  const cargarStock = useCallback(async () => {
    try {
      const r = await fetch(`/api/gestion-inventario${stockQuery}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar stock");
      setStock(d.stock || []);
      setResumen(d.resumen || null);
    } catch (e) { showToast(String(e), "err"); }
  }, [stockQuery]);

  const cargarKardex = useCallback(async () => {
    try {
      const r = await fetch(`/api/gestion-inventario/kardex${kardexQuery}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar kardex");
      setKardex(d.movimientos || []);
    } catch (e) { showToast(String(e), "err"); }
  }, [kardexQuery]);

  useEffect(() => {
    cargarBodegas();
    cargarProductos();
    cargarStock();
  }, [cargarBodegas, cargarProductos, cargarStock]);

  useEffect(() => {
    if (tab !== "kardex") return;
    cargarKardex();
  }, [tab, cargarKardex]);

  useEffect(() => {
    setPage(1);
  }, [tab, qStock, qKardex, qBodegas, filtroBodega, filtroProducto, soloBajoMinimo, incluirInactivos, perPage]);

  // Al cambiar el producto de "Entrada de stock", carga sus presentaciones
  // reales (con factor_conversion) en vez de asumir que "Caja" = 1 unidad.
  useEffect(() => {
    setEntradaForm(f => ({ ...f, id_presentacion: "" }));
    if (!entradaForm.id_producto) {
      setEntradaPresentaciones([]);
      return;
    }
    fetch(`/api/presentaciones?id_producto=${entradaForm.id_producto}`)
      .then(r => r.json())
      .then(d => setEntradaPresentaciones(d.presentaciones || []))
      .catch(() => setEntradaPresentaciones([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entradaForm.id_producto]);

  // Buscador de producto para la pestaña "Presentaciones" (mismo patrón que
  // el buscador de clientes en Deudas): filtra por código o nombre en vez de
  // mostrar un <select> con todos los productos.
  const presProductosFiltrados = useMemo(
    () => productos.filter((p) => matchesQuery(presProductoQuery, p.codigo_producto, p.nombre_producto)),
    [productos, presProductoQuery]
  );

  const stockFiltrado = useMemo(
    () =>
      stock.filter((r) =>
        matchesQuery(
          qStock,
          r.nombre_bodega,
          r.ubicacion,
          r.codigo_producto,
          r.nombre_producto,
          r.nombre_categoria,
          r.nombre_marca
        )
      ),
    [stock, qStock]
  );

  const kardexFiltrado = useMemo(
    () =>
      kardex.filter((m) =>
        matchesQuery(
          qKardex,
          m.nombre_bodega,
          m.codigo_producto,
          m.nombre_producto,
          m.descripcion,
          m.tipo_movimiento
        )
      ),
    [kardex, qKardex]
  );

  const bodegasFiltradas = useMemo(
    () => bodegas.filter((b) => matchesQuery(qBodegas, b.nombre_bodega, b.ubicacion, b.id_bodega)),
    [bodegas, qBodegas]
  );

  const stockPage = useMemo(() => paginar(stockFiltrado, page, perPage), [stockFiltrado, page, perPage]);
  const kardexPage = useMemo(() => paginar(kardexFiltrado, page, perPage), [kardexFiltrado, page, perPage]);
  const bodegasPage = useMemo(() => paginar(bodegasFiltradas, page, perPage), [bodegasFiltradas, page, perPage]);

  // ── Operaciones ────────────────────────────────────────────────────────────

  const patchMinimo = async (idBodega: number, idProducto: number) => {
    const key = `${idBodega}:${idProducto}`;
    const minimo = Number((minEdits[key] ?? "").trim());
    if (!Number.isFinite(minimo) || minimo < 0) { showToast("Stock mínimo inválido", "err"); return; }
    try {
      const r = await fetch("/api/gestion-inventario/stock-minimo", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_bodega: idBodega, id_producto: idProducto, stock_minimo: minimo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo actualizar");
      showToast("Stock mínimo actualizado", "ok");
      setMinEdits(m => { const next = { ...m }; delete next[key]; return next; });
      await cargarStock();
    } catch (e) { showToast(String(e), "err"); }
  };

  const registrarEntrada = async () => {
    setEntradaLoading(true);
    setEntradaError(null);
    setEntradaResultado(null);
    try {
      const usaPresentacion = !!entradaForm.id_presentacion;
      const payload: Record<string, unknown> = {
        id_bodega: Number(entradaForm.id_bodega),
        id_producto: Number(entradaForm.id_producto),
        descripcion: entradaForm.descripcion,
      };
      if (usaPresentacion) {
        payload.id_presentacion = Number(entradaForm.id_presentacion);
        payload.cantidad_presentacion = Number(entradaForm.cantidad);
      } else {
        payload.cantidad = Number(entradaForm.cantidad);
        payload.tipo_ingreso = entradaForm.tipo_ingreso;
      }
      const res = await fetch("/api/inventario/entrada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setEntradaError(data.error || "Error desconocido"); }
      else {
        setEntradaResultado(data.stock);
        setEntradaForm(f => ({ ...f, id_producto: "", id_presentacion: "", cantidad: "", tipo_ingreso: "UNIDADES", descripcion: "" }));
        showToast("Entrada registrada ✓", "ok");
        await cargarStock();
      }
    } catch { setEntradaError("No se pudo conectar con el servidor"); }
    finally { setEntradaLoading(false); }
  };

  const registrarTransferencia = async () => {
    try {
      const r = await fetch("/api/gestion-inventario/transferencia", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_bodega_origen: Number(xfer.id_bodega_origen), id_bodega_destino: Number(xfer.id_bodega_destino), id_producto: Number(xfer.id_producto), cantidad: Number(xfer.cantidad), descripcion: xfer.descripcion }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo transferir");
      showToast(d.mensaje || "Transferencia OK", "ok");
      setXfer(x => ({ ...x, id_producto: "", cantidad: "", descripcion: "" }));
      await cargarStock();
    } catch (e) { showToast(String(e), "err"); }
  };

  const registrarAjuste = async () => {
    try {
      const r = await fetch("/api/gestion-inventario/ajuste", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_bodega: Number(adj.id_bodega), id_producto: Number(adj.id_producto), nueva_cantidad: Number(adj.nueva_cantidad), descripcion: adj.descripcion }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo ajustar");
      showToast(d.mensaje || "Ajuste OK", "ok");
      setAdj(a => ({ ...a, nueva_cantidad: "", descripcion: "" }));
      await cargarStock();
    } catch (e) { showToast(String(e), "err"); }
  };

  // ── Bodegas CRUD ───────────────────────────────────────────────────────────

  const abrirCrearBodega = () => { setEditandoBodega(null); setBodegaForm({ ...EMPTY_BODEGA_FORM }); setBodegaFormError(""); setModalBodegaOpen(true); };
  const abrirEditarBodega = (b: Bodega) => { setEditandoBodega(b); setBodegaForm({ nombre_bodega: b.nombre_bodega, ubicacion: b.ubicacion ?? "" }); setBodegaFormError(""); setModalBodegaOpen(true); };
  const cerrarModalBodega = () => { setModalBodegaOpen(false); setEditandoBodega(null); setBodegaFormError(""); };

  const handleGuardarBodega = async () => {
    if (!bodegaForm.nombre_bodega.trim()) { setBodegaFormError("El nombre de la bodega es obligatorio"); return; }
    setSavingBodega(true);
    setBodegaFormError("");
    const url = editandoBodega ? `/api/bodegas/${editandoBodega.id_bodega}` : "/api/bodegas";
    const method = editandoBodega ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre_bodega: bodegaForm.nombre_bodega.trim(), ubicacion: bodegaForm.ubicacion.trim() || null }) });
      const data = await res.json();
      if (!res.ok) { setBodegaFormError(data.error || "Error al guardar"); }
      else { cerrarModalBodega(); cargarBodegas(); showToast(editandoBodega ? "Bodega actualizada ✓" : "Bodega creada ✓", "ok"); }
    } catch { setBodegaFormError("No se pudo conectar con el servidor"); }
    finally { setSavingBodega(false); }
  };

  const handleEliminarBodega = async (id: number) => {
    setDeletingBodega(true);
    try {
      const res = await fetch(`/api/bodegas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) showToast(data.error || "Error al eliminar", "err");
      else { showToast("Bodega eliminada ✓", "ok"); cargarBodegas(); }
    } catch { showToast("Error de conexión", "err"); }
    finally { setDeletingBodega(false); setConfirmDeleteBodega(null); }
  };

  // ── Presentaciones CRUD ────────────────────────────────────────────────────

  const cargarPresentaciones = useCallback((idProducto: string) => {
    if (!idProducto) { setPresLista([]); return; }
    fetch(`/api/presentaciones?id_producto=${idProducto}`)
      .then((r) => r.json())
      .then((d) => setPresLista(d.presentaciones || []))
      .catch(() => setPresLista([]));
  }, []);

  useEffect(() => {
    if (tab === "presentaciones") cargarPresentaciones(presProductoId);
  }, [tab, presProductoId, cargarPresentaciones]);

  const crearPresentacion = async () => {
    setPresError("");
    if (!presProductoId) { setPresError("Selecciona un producto"); return; }
    if (!presNombre.trim()) { setPresError("El nombre de la presentación es obligatorio"); return; }
    const factor = Number(presFactor);
    if (!(factor > 0)) { setPresError("El factor debe ser un número mayor a 0"); return; }

    setPresGuardando(true);
    try {
      const r = await fetch("/api/presentaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_producto: Number(presProductoId), nombre_presentacion: presNombre.trim(), factor_conversion: factor }),
      });
      const d = await r.json();
      if (!r.ok) { setPresError(d.error || "Error al guardar"); }
      else { setPresNombre(""); setPresFactor(""); cargarPresentaciones(presProductoId); showToast("Presentación creada ✓", "ok"); }
    } catch { setPresError("Error de conexión"); }
    finally { setPresGuardando(false); }
  };

  const eliminarPresentacion = async (id: number) => {
    try {
      const r = await fetch(`/api/presentaciones/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) showToast(d.error || "Error al eliminar", "err");
      else { showToast("Presentación eliminada ✓", "ok"); cargarPresentaciones(presProductoId); }
    } catch { showToast("Error de conexión", "err"); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const productoSeleccionado = productos.find(p => p.id_producto === Number(entradaForm.id_producto));

  return (
    <div className="flex flex-col gap-4">
      {/* Búsqueda + filtros en fila (stock y kardex) */}
      <div className={`${cls.card} p-4`}>
        {(tab === "stock" || tab === "kardex") && (
          <div className={cls.filterBlock}>
            <div className={cls.toolbar}>
              <input
                type="search"
                value={tab === "stock" ? qStock : qKardex}
                onChange={(e) => (tab === "stock" ? setQStock(e.target.value) : setQKardex(e.target.value))}
                placeholder={tab === "stock" ? "Buscar producto, código, bodega…" : "Buscar movimiento, producto, bodega…"}
                aria-label={tab === "stock" ? "Buscar en stock" : "Buscar en kardex"}
                className={`${cls.searchInput} flex-[1_1_240px] min-w-[200px]`}
              />
              <select value={filtroBodega} onChange={e => setFiltroBodega(e.target.value)} className={`${cls.selectInline} min-w-[180px]`} aria-label="Filtrar por bodega">
                <option value="">Todas las bodegas</option>
                {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
              </select>
              <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)} className={`${cls.selectInline} min-w-[220px]`} aria-label="Filtrar por producto">
                <option value="">Todos los productos</option>
                {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}{!p.estado_producto ? " (inactivo)" : ""}</option>)}
              </select>
            </div>
            {tab === "stock" && (
              <div className={cls.checkRow}>
                <label className={cls.check}><input type="checkbox" checked={soloBajoMinimo} onChange={e => setSoloBajoMinimo(e.target.checked)} className="accent-market" /> Solo bajo mínimo</label>
                <label className={cls.check}><input type="checkbox" checked={incluirInactivos} onChange={e => setIncluirInactivos(e.target.checked)} className="accent-market" /> Incluir inactivos</label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: STOCK
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "stock" && (
        <div className={`${cls.card} p-0 overflow-hidden`}>
          <div className="overflow-auto">
            <table className="w-full border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-surface-soft">
                  <th className={cls.th}>Bodega</th>
                  <th className={cls.th}>Producto</th>
                  <th className={`${cls.th} text-right`}>Stock</th>
                  <th className={`${cls.th} text-right`}>Mínimo</th>
                  <th className={cls.th}>Alerta</th>
                  <th className={cls.th}>Última act.</th>
                  <th className={cls.th}>Guardar mínimo</th>
                </tr>
              </thead>
              <tbody>
                {stockPage.slice.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-ink-muted">{qStock.trim() ? "Ningún resultado para esa búsqueda." : "No hay filas para estos filtros."}</td></tr>
                ) : stockPage.slice.map(r => {
                  const key = `${r.id_bodega}:${r.id_producto}`;
                  const minVal = minEdits[key] ?? String(r.stock_minimo);
                  return (
                    <tr key={key} className="border-t border-line">
                      <td className={cls.td}>
                        <div className="font-semibold">{r.nombre_bodega}</div>
                        <div className="text-[0.78rem] text-ink-muted">{r.ubicacion || "—"}</div>
                      </td>
                      <td className={cls.td}>
                        <div className="font-semibold"><code className={cls.code}>{r.codigo_producto}</code> {r.nombre_producto}</div>
                        <div className="text-[0.78rem] text-ink-muted">{r.nombre_categoria} · {r.nombre_marca} · {r.unidad_medida}{!r.estado_producto ? " · inactivo" : ""}</div>
                      </td>
                      <td className={`${cls.td} text-right tabular-nums`}>{Number(r.cantidad_disponible).toFixed(3)}</td>
                      <td className={`${cls.td} text-right`}>
                        <input value={minVal} onChange={e => setMinEdits(m => ({ ...m, [key]: e.target.value }))} className="bg-surface-soft border border-line rounded-[10px] px-[0.55rem] py-[0.45rem] text-ink text-[0.9rem] outline-none w-full max-w-[120px] text-right" />
                      </td>
                      <td className={cls.td}>{r.bajo_minimo ? <span className={cls.badgeWarn}>Bajo mínimo</span> : <span className={cls.badgeOk}>OK</span>}</td>
                      <td className={`${cls.td} text-[0.82rem] text-ink-muted`}>{new Date(r.ultima_actualizacion).toLocaleString("es-GT")}</td>
                      <td className={cls.td}>
                        <button type="button" className={`${cls.btnPrimary} bg-market text-black`} onClick={() => void patchMinimo(r.id_bodega, r.id_producto)}>Guardar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            total={stockPage.total}
            page={stockPage.safePage}
            perPage={perPage}
            onPage={setPage}
            onPerPage={setPerPage}
            pageSizes={PAGE_SIZES_COMPACT}
            variant="inventario"
            noun="filas"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: OPERACIONES
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "operaciones" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">

          {/* Entrada de stock */}
          <div className={`${cls.card} p-4`}>
            <h3 className={cls.h3}><Icon name ="box" variant="dark" size={24}/> Entrada de stock</h3>
            <p className={cls.help}>Registra el ingreso de mercancía. Queda trazado en kardex.</p>
            <div className={cls.field}>
              <label className={cls.label}>Bodega *</label>
              <select value={entradaForm.id_bodega} onChange={e => { setEntradaForm(f => ({ ...f, id_bodega: e.target.value })); setEntradaError(null); setEntradaResultado(null); }} className={cls.select}>
                <option value="">— Selecciona —</option>
                {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
              </select>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Producto *</label>
              <select value={entradaForm.id_producto} onChange={e => { setEntradaForm(f => ({ ...f, id_producto: e.target.value })); setEntradaError(null); setEntradaResultado(null); }} className={cls.select}>
                <option value="">— Selecciona —</option>
                {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
              </select>
              {productoSeleccionado && <span className="text-[0.78rem] text-ink-muted">Unidad: <strong className="text-ink">{productoSeleccionado.unidad_medida}</strong></span>}
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className={`${cls.field} flex-[1_1_160px]`}>
                <label className={cls.label}>Se ingresa en *</label>
                <select value={entradaForm.id_presentacion} onChange={e => setEntradaForm(f => ({ ...f, id_presentacion: e.target.value }))} className={cls.select}>
                  <option value="">{productoSeleccionado ? `Unidad base (${productoSeleccionado.unidad_medida})` : "Unidad base"}</option>
                  {entradaPresentaciones.map(p => (
                    <option key={p.id_presentacion} value={p.id_presentacion}>
                      {p.nombre_presentacion} (× {Number(p.factor_conversion)} {productoSeleccionado?.unidad_medida || "unidades"})
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${cls.field} flex-[1_1_120px]`}>
                <label className={cls.label}>Cantidad *</label>
                <input type="number" min="0.001" step="1" value={entradaForm.cantidad} onChange={e => setEntradaForm(f => ({ ...f, cantidad: e.target.value }))} className={cls.select} />
                {entradaForm.id_presentacion && entradaForm.cantidad && (
                  <span className="text-[0.75rem] text-ink-muted">
                    = {(Number(entradaForm.cantidad) * Number(entradaPresentaciones.find(p => p.id_presentacion === Number(entradaForm.id_presentacion))?.factor_conversion || 1)).toLocaleString("es-GT")} {productoSeleccionado?.unidad_medida || "unidades"} en total
                  </span>
                )}
              </div>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Descripción (opcional)</label>
              <textarea value={entradaForm.descripcion} onChange={e => setEntradaForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} placeholder="Ej: Compra a proveedor XYZ…" className={`${cls.select} resize-y`} />
            </div>
            <button type="button" onClick={registrarEntrada} disabled={entradaLoading || !entradaForm.id_bodega || !entradaForm.id_producto || !entradaForm.cantidad} className={`${cls.btnPrimary} bg-market text-[var(--info-bg)] ${(!entradaForm.id_bodega || !entradaForm.id_producto || !entradaForm.cantidad) ? "opacity-50" : ""}`}>
              {entradaLoading ? "Registrando…" : "Registrar entrada"}
            </button>
            {entradaError && <div className={cls.alertErr}>{entradaError}</div>}
            {entradaResultado && (
              <div className={cls.alertOk}>
                <strong className="text-ink">Entrada registrada</strong>
                <div className="text-[0.82rem] mt-[0.35rem] text-ink-muted">
                  {entradaResultado.nombre_producto} · {entradaResultado.nombre_bodega}<br />
                  Stock actual: <strong className="text-ink">{Number(entradaResultado.cantidad_disponible).toFixed(2)} {entradaResultado.unidad_medida}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Transferencia */}
          <div className={`${cls.card} p-4`}>
            <h3 className={cls.h3}><Icon name ="transfer" variant="dark" size={24}/>Transferencia entre bodegas</h3>
            <p className={cls.help}>Descuenta en origen, suma en destino y genera 2 movimientos en kardex.</p>
            <div className={cls.field}>
              <label className={cls.label}>Bodega origen</label>
              <select value={xfer.id_bodega_origen} onChange={e => setXfer(x => ({ ...x, id_bodega_origen: e.target.value }))} className={cls.select}>
                <option value="">— Selecciona —</option>
                {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
              </select>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Bodega destino</label>
              <select value={xfer.id_bodega_destino} onChange={e => setXfer(x => ({ ...x, id_bodega_destino: e.target.value }))} className={cls.select}>
                <option value="">— Selecciona —</option>
                {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
              </select>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Producto</label>
              <select value={xfer.id_producto} onChange={e => setXfer(x => ({ ...x, id_producto: e.target.value }))} className={cls.select}>
                <option value="">— Selecciona —</option>
                {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
              </select>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Cantidad</label>
              <input type="number" min="0.001" step="1" value={xfer.cantidad} onChange={e => setXfer(x => ({ ...x, cantidad: e.target.value }))} className={cls.select} inputMode="decimal" />
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Descripción (opcional)</label>
              <input value={xfer.descripcion} onChange={e => setXfer(x => ({ ...x, descripcion: e.target.value }))} className={cls.select} placeholder="Ej: Reubicación por temporada" />
            </div>
            <button type="button" className={`${cls.btnPrimary} bg-market text-[var(--info-bg)]`} onClick={() => void registrarTransferencia()} disabled={!xfer.id_bodega_origen || !xfer.id_bodega_destino || !xfer.id_producto || !xfer.cantidad}>
              Registrar transferencia
            </button>
          </div>

          {/* Ajuste */}
          <div className={`${cls.card} p-4`}>
            <h3 className={cls.h3}><Icon name ="setting" variant="dark" size={24}/> Ajuste de inventario</h3>
            <p className={cls.help}>Define el <strong>stock real</strong> en una bodega. El delta se registra como <code className={cls.code}>AJUSTE</code> en kardex.</p>
            <div className={cls.field}>
              <label className={cls.label}>Bodega</label>
              <select value={adj.id_bodega} onChange={e => setAdj(a => ({ ...a, id_bodega: e.target.value }))} className={cls.select}>
                <option value="">— Selecciona —</option>
                {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
              </select>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Producto</label>
              <select value={adj.id_producto} onChange={e => setAdj(a => ({ ...a, id_producto: e.target.value }))} className={cls.select}>
                <option value="">— Selecciona —</option>
                {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
              </select>
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Nueva cantidad (stock físico)</label>
              <input type="number" min="0" step="1" value={adj.nueva_cantidad} onChange={e => setAdj(a => ({ ...a, nueva_cantidad: e.target.value }))} className={cls.select} inputMode="decimal" />
            </div>
            <div className={cls.field}>
              <label className={cls.label}>Motivo / nota (opcional)</label>
              <input value={adj.descripcion} onChange={e => setAdj(a => ({ ...a, descripcion: e.target.value }))} className={cls.select} placeholder="Ej: Conteo físico, merma…" />
            </div>
            <button type="button" className={`${cls.btnPrimary} bg-market text-[var(--info-bg)]`} onClick={() => void registrarAjuste()} disabled={!adj.id_bodega || !adj.id_producto || !adj.nueva_cantidad}>
              Aplicar ajuste
            </button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: KARDEX
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "kardex" && (
        <div className={`${cls.card} p-0 overflow-hidden`}>
          <div className="overflow-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-surface-soft">
                  <th className={cls.th}>Fecha</th>
                  <th className={cls.th}>Tipo</th>
                  <th className={cls.th}>Bodega</th>
                  <th className={cls.th}>Producto</th>
                  <th className={`${cls.th} text-right`}>Cantidad</th>
                  <th className={cls.th}>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {kardexPage.slice.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-ink-muted">{qKardex.trim() ? "Ningún resultado para esa búsqueda." : "No hay movimientos para estos filtros."}</td></tr>
                ) : kardexPage.slice.map(m => (
                  <tr key={m.id_kardex} className="border-t border-line">
                    <td className={`${cls.td} text-[0.82rem] text-ink-muted whitespace-nowrap`}>{new Date(m.fecha_movimiento).toLocaleString("es-GT")}</td>
                    <td className={cls.td}><span className={tipoBadgeClass(m.tipo_movimiento)}>{m.tipo_movimiento}</span></td>
                    <td className={cls.td}><div className="font-semibold">{m.nombre_bodega}</div></td>
                    <td className={cls.td}><div className="font-semibold"><code className={cls.code}>{m.codigo_producto}</code> {m.nombre_producto}</div><div className="text-[0.78rem] text-ink-muted">{m.unidad_medida}</div></td>
                    <td className={`${cls.td} text-right tabular-nums`}>{Number(m.cantidad).toFixed(3)}</td>
                    <td className={`${cls.td} text-ink-muted text-[0.88rem]`}>{m.descripcion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            total={kardexPage.total}
            page={kardexPage.safePage}
            perPage={perPage}
            onPage={setPage}
            onPerPage={setPerPage}
            pageSizes={PAGE_SIZES_COMPACT}
            variant="inventario"
            noun="movimientos"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: BODEGAS
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "bodegas" && (
        <>
          <div className={`${cls.toolbar} mt-0`}>
            <input
              type="search"
              value={qBodegas}
              onChange={(e) => setQBodegas(e.target.value)}
              placeholder="Buscar bodega o ubicación…"
              aria-label="Buscar bodegas"
              className={`${cls.searchInput} flex-[1_1_240px] min-w-[200px]`}
            />
            <button type="button" onClick={abrirCrearBodega} className={`${cls.btnPrimary} bg-market text-[var(--info-bg)]`}>+ Nueva bodega</button>
          </div>
          <div className={`${cls.card} p-0 overflow-hidden`}>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-soft">
                    <th className={cls.th}>ID</th>
                    <th className={cls.th}>Nombre</th>
                    <th className={cls.th}>Ubicación</th>
                    <th className={`${cls.th} text-right`}>Productos</th>
                    <th className={`${cls.th} text-right`}>Stock total</th>
                    <th className={`${cls.th} text-center`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bodegasPage.slice.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-ink-muted">{qBodegas.trim() ? "Ningún resultado para esa búsqueda." : "No hay bodegas registradas."}</td></tr>
                  ) : bodegasPage.slice.map((b, i) => (
                    <tr key={b.id_bodega} className={i % 2 === 0 ? "bg-surface-soft" : "bg-surface"}>
                      <td className={`${cls.td} text-ink-muted font-mono`}>#{b.id_bodega}</td>
                      <td className={`${cls.td} font-semibold`}>{b.nombre_bodega}</td>
                      <td className={`${cls.td} text-ink-muted`}>{b.ubicacion || "—"}</td>
                      <td className={`${cls.td} text-right`}>{b.total_productos}</td>
                      <td className={`${cls.td} text-right tabular-nums`}>{Number(b.stock_total).toLocaleString("es-GT", { maximumFractionDigits: 3 })}</td>
                      <td className={`${cls.td} text-center`}>
                        <div className="flex gap-[0.4rem] justify-center">
                          <button type="button" onClick={() => abrirEditarBodega(b)} className={cls.btnEdit} title="Editar">✏️</button>
                          <button type="button" onClick={() => setConfirmDeleteBodega(b.id_bodega)} className={cls.btnDel} title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              total={bodegasPage.total}
              page={bodegasPage.safePage}
              perPage={perPage}
              onPage={setPage}
              onPerPage={setPerPage}
              pageSizes={PAGE_SIZES_COMPACT}
              variant="inventario"
              noun="bodegas"
            />
          </div>
        </>
      )}

      {tab === "presentaciones" && (
        <>
          <div className={`${cls.toolbar} mt-0`}>
            <div className="relative min-w-[280px]">
              <input
                className={`${cls.selectInline} min-w-[180px]`}
                placeholder="Buscar producto por código o nombre…"
                value={presProductoQuery}
                onChange={(e) => {
                  setPresProductoQuery(e.target.value);
                  setPresProductoId("");
                  setPresSugerenciasAbiertas(true);
                }}
                onFocus={() => setPresSugerenciasAbiertas(true)}
                onBlur={() => setTimeout(() => setPresSugerenciasAbiertas(false), 150)}
                aria-label="Buscar producto para configurar presentaciones"
              />
              {presSugerenciasAbiertas && presProductoQuery.trim() !== "" && !presProductoId && (
                <div className="absolute top-full left-0 right-0 bg-surface border border-line rounded-md mt-0.5 z-20 max-h-[220px] overflow-y-auto shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
                  {presProductosFiltrados.length === 0 ? (
                    <div className="px-[0.7rem] py-2 text-[0.85rem] text-ink-muted">
                      Sin resultados para esa búsqueda.
                    </div>
                  ) : (
                    presProductosFiltrados.slice(0, 8).map((p) => (
                      <div
                        key={p.id_producto}
                        onMouseDown={() => {
                          setPresProductoId(String(p.id_producto));
                          setPresProductoQuery(`[${p.codigo_producto}] ${p.nombre_producto}`);
                          setPresSugerenciasAbiertas(false);
                        }}
                        className="px-[0.7rem] py-[0.45rem] cursor-pointer text-[0.85rem] border-b border-line"
                      >
                        <code className={cls.code}>{p.codigo_producto}</code> {p.nombre_producto}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {presProductoId && (
            <div className={`${cls.card} p-4 flex flex-col gap-[0.85rem]`}>
              <div className="text-[0.85rem] text-ink-muted">
                Presentaciones que el bodeguero puede usar al registrar entradas/salidas de este producto
                (ej. &quot;Caja de 24&quot; = 24 unidades base).
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-soft">
                    <th className={cls.th}>Presentación</th>
                    <th className={`${cls.th} text-right`}>Equivale a (unidad base)</th>
                    <th className={`${cls.th} text-center`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {presLista.length === 0 ? (
                    <tr><td colSpan={3} className="text-center p-5 text-ink-muted">Este producto no tiene presentaciones configuradas.</td></tr>
                  ) : presLista.map((pr) => (
                    <tr key={pr.id_presentacion}>
                      <td className={`${cls.td} font-semibold`}>{pr.nombre_presentacion}</td>
                      <td className={`${cls.td} text-right`}>{Number(pr.factor_conversion).toLocaleString("es-GT")}</td>
                      <td className={`${cls.td} text-center`}>
                        <button type="button" onClick={() => eliminarPresentacion(pr.id_presentacion)} className={cls.btnDel} title="Eliminar">
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex gap-[0.6rem] items-end flex-wrap">
                <div className="flex flex-col gap-[0.3rem] flex-[1_1_220px] min-w-[180px]">
                  <label className="text-[0.75rem] text-ink-muted">Nombre (ej. Caja de 24)</label>
                  <input value={presNombre} onChange={(e) => setPresNombre(e.target.value)} className={`${cls.searchInput} flex-[0_0_auto] w-full`} />
                </div>
                <div className="flex flex-col gap-[0.3rem] flex-[0_0_120px]">
                  <label className="text-[0.75rem] text-ink-muted">Factor (unidades base)</label>
                  <input type="number" min="0" step="1" value={presFactor} onChange={(e) => setPresFactor(e.target.value)} className={`${cls.searchInput} flex-[0_0_auto] w-full`} />
                </div>
                <button type="button" onClick={crearPresentacion} disabled={presGuardando} className={`${cls.btnPrimary} bg-market text-[var(--info-bg)]`}>
                  {presGuardando ? "Guardando…" : "+ Agregar presentación"}
                </button>
              </div>
              {presError && <div className="text-achiote text-[0.85rem]">{presError}</div>}
            </div>
          )}
        </>
      )}

      {/* ── Modal Bodega ── */}
      {modalBodegaOpen && (
        <div
          className="fixed inset-0 w-screen h-screen bg-black/50 backdrop-blur-[4px] flex items-center justify-center z-[101] p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrarModalBodega(); }}
        >
          <div className="bg-surface text-ink border border-line rounded-[12px] max-w-[480px] w-[90%] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-line">
              <h2 className="font-head text-[1.1rem] font-bold text-ink m-0">
                {editandoBodega ? "Editar bodega" : "Nueva bodega"}
              </h2>
              <button
                type="button"
                onClick={cerrarModalBodega}
                className="bg-transparent border-none text-ink text-base cursor-pointer px-[0.4rem] py-[0.2rem]"
              >
                ✕
              </button>
            </div>
            <div className="px-6 pb-6 pt-0 flex flex-col gap-4">
              <div className="flex flex-col gap-[0.35rem] mb-4">
                <label className="text-[0.82rem] font-semibold text-ink block mb-1">
                  Nombre *
                </label>
                <input
                  className="bg-surface-soft text-ink border border-line rounded-lg px-[0.85rem] py-[0.65rem] text-[0.92rem] outline-none w-full"
                  value={bodegaForm.nombre_bodega}
                  onChange={e => setBodegaForm(f => ({ ...f, nombre_bodega: e.target.value }))}
                  placeholder="Bodega Principal"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-[0.35rem] mb-4">
                <label className="text-[0.82rem] font-semibold text-ink block mb-1">
                  Ubicación
                </label>
                <input
                  className="bg-surface-soft text-ink border border-line rounded-lg px-[0.85rem] py-[0.65rem] text-[0.92rem] outline-none w-full"
                  value={bodegaForm.ubicacion}
                  onChange={e => setBodegaForm(f => ({ ...f, ubicacion: e.target.value }))}
                  placeholder="Zona 1, Guatemala"
                />
              </div>
              {bodegaFormError && (
                <p className="text-danger-strong text-[0.85rem] m-0">
                  {bodegaFormError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-line">
              <button type="button" onClick={cerrarModalBodega} className={cls.btnSecondary} disabled={savingBodega}>
                Cancelar
              </button>
              <button type="button" onClick={handleGuardarBodega} className={cls.btnSecondary} disabled={savingBodega}>
                {savingBodega ? "Guardando…" : editandoBodega ? "Guardar cambios" : "Crear bodega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete bodega ── */}
      {confirmDeleteBodega !== null && (
        <div className={cls.overlay}>
          <div className={`${cls.modal} max-w-[420px]`}>
            <div className={cls.modalHeader}><h2 className={cls.modalTitle}>¿Eliminar bodega?</h2></div>
            <div className={cls.modalBody}>
              <p className="text-ink-muted leading-[1.6]">Solo se puede eliminar si la bodega <strong className="text-ink">no tiene stock activo</strong>. Si tiene productos, transfiere o ajusta el inventario primero.</p>
            </div>
            <div className={cls.modalFooter}>
              <button type="button" onClick={() => setConfirmDeleteBodega(null)} className={cls.btnSecondary} disabled={deletingBodega}>Cancelar</button>
              <button type="button" onClick={() => handleEliminarBodega(confirmDeleteBodega)} className={`${cls.btnPrimary} bg-achiote text-[var(--info-bg)]`} disabled={deletingBodega}>{deletingBodega ? "Eliminando…" : "Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`${cls.toast} ${toast.tipo === "ok" ? "bg-ok/[.15] border-ok/[.40] text-market" : "bg-err/[.15] border-err/[.40] text-achiote"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/** Clases del badge de tipo de movimiento. Antes era tipoBadge() con rgba/hex. */
function tipoBadgeClass(tipo: KardexRow["tipo_movimiento"]): string {
  if (tipo === "ENTRADA") return `${cls.pill} bg-ok/[.12] border-ok/[.35] text-market`;
  if (tipo === "SALIDA") return `${cls.pill} bg-err/[.10] border-err/[.30] text-achiote`;
  return `${cls.pill} bg-feedback-info/[.12] border-feedback-info/[.30] text-[var(--blue)]`;
}

// ── Clases Tailwind reutilizables (DEV-192) ────────────────────────────────────
// Reemplazan al antiguo objeto `s: Record<string, CSSProperties>` y a los inline
// styles. Los colores salen de los tokens del tema (surface, line, ink, market,
// achiote, ok, err, warn…), que mapean a las variables CSS de globals.css.

const cls = {
  card: "bg-surface border border-line rounded-control",
  select: "bg-surface-soft border border-line rounded-[10px] px-3 py-[0.55rem] text-ink text-[0.9rem] outline-none w-full",
  selectInline: "bg-surface-soft border border-line rounded-[10px] px-3 py-[0.55rem] text-ink text-[0.9rem] outline-none max-w-[280px] flex-[0_1_auto]",
  filterBlock: "flex flex-col gap-[0.65rem] mt-4",
  toolbar: "flex flex-row items-center gap-3 flex-wrap",
  checkRow: "flex flex-row items-center gap-5 flex-nowrap",
  searchInput: "bg-surface-soft border border-line rounded-[10px] px-3 py-[0.55rem] text-ink text-[0.9rem] outline-none",
  check: "flex items-center gap-[0.45rem] text-ink-muted text-[0.85rem] select-none cursor-pointer whitespace-nowrap",
  btnPrimary: "border-none rounded-[10px] px-[0.9rem] py-[0.65rem] font-bold cursor-pointer text-[0.88rem] whitespace-nowrap",
  btnSecondary: "bg-transparent text-ink-muted border border-line rounded-control px-[1.2rem] py-[0.6rem] text-[0.88rem] cursor-pointer",
  btnEdit: "bg-surface-soft border border-line rounded-md px-[0.5rem] py-[0.3rem] cursor-pointer text-[0.85rem]",
  btnDel: "bg-err/[.10] border border-err/[.25] rounded-md px-[0.5rem] py-[0.3rem] cursor-pointer text-[0.85rem]",
  th: "text-left px-[0.85rem] py-3 text-[0.72rem] tracking-[0.06em] uppercase text-ink-muted border-b border-line whitespace-nowrap",
  td: "px-[0.85rem] py-3 align-top",
  code: "font-mono text-[0.78rem] px-[0.35rem] py-[0.1rem] rounded-md border border-line bg-surface-soft text-market",
  badgeOk: "inline-block px-[0.55rem] py-[0.15rem] rounded-full border border-ok/[.35] bg-ok/[.10] text-market text-[0.78rem] font-bold",
  badgeWarn: "inline-block px-[0.55rem] py-[0.15rem] rounded-full border border-warn/[.35] bg-warn/[.10] text-market text-[0.78rem] font-bold",
  h3: "m-0 mb-[0.35rem] font-head text-[1.05rem]",
  help: "m-0 mb-4 text-ink-muted text-[0.88rem] leading-[1.55]",
  field: "flex flex-col gap-[0.35rem] mb-[0.85rem]",
  label: "text-[0.82rem] font-bold text-ink-muted",
  alertErr: "mt-3 bg-err/[.12] border border-err/[.30] rounded-lg px-[0.85rem] py-[0.65rem] text-achiote text-[0.85rem]",
  alertOk: "mt-3 bg-ok/[.12] border border-ok/[.35] rounded-lg px-[0.85rem] py-3 text-market text-[0.85rem]",
  overlay: "fixed inset-0 bg-black/65 backdrop-blur-[4px] flex items-center justify-center z-[200] p-4",
  modal: "bg-surface border border-line rounded-[14px] w-full shadow-warm overflow-hidden",
  modalHeader: "flex items-center justify-between px-6 py-5 border-b border-line",
  modalTitle: "font-head text-[1.1rem] font-bold text-ink m-0",
  modalBody: "p-6 flex flex-col gap-4",
  modalFooter: "flex justify-end gap-3 px-6 py-4 border-t border-line",
  toast: "fixed bottom-8 right-8 px-5 py-[0.85rem] rounded-control border text-[0.88rem] font-medium z-[300] backdrop-blur-[8px] shadow-warm",
  pill: "inline-block px-[0.55rem] py-[0.15rem] rounded-full border text-[0.78rem] font-extrabold tracking-[0.04em]",
};