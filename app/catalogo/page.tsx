"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";

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

type TabKey = "stock" | "operaciones" | "kardex" | "bodegas";

const EMPTY_BODEGA_FORM = { nombre_bodega: "", ubicacion: "" };

// ─── Componente principal ─────────────────────────────────────────────────────

export default function InventarioPage() {
  const usuario = useDuenoSession();

  const [tab, setTab] = useState<TabKey>("stock");

  // Maestros
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [bodegasSimple, setBodegasSimple] = useState<{ id_bodega: number; nombre_bodega: string }[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Filtros comunes
  const [filtroBodega, setFiltroBodega] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  // Stock
  const [stock, setStock] = useState<StockRow[]>([]);
  const [resumen, setResumen] = useState<{ filas: number; bajo_minimo: number } | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [minEdits, setMinEdits] = useState<Record<string, string>>({});

  // Kardex
  const [kardex, setKardex] = useState<KardexRow[]>([]);
  const [loadingKardex, setLoadingKardex] = useState(false);

  // Operaciones: Entrada
  const [entradaForm, setEntradaForm] = useState({ id_bodega: "", id_producto: "", cantidad: "", tipo_ingreso: "UNIDADES", descripcion: "" });
  const [entradaLoading, setEntradaLoading] = useState(false);
  const [entradaResultado, setEntradaResultado] = useState<StockActualizado | null>(null);
  const [entradaError, setEntradaError] = useState<string | null>(null);

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
    p.set("limit", "200");
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
    setLoadingStock(true);
    try {
      const r = await fetch(`/api/gestion-inventario${stockQuery}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar stock");
      setStock(d.stock || []);
      setResumen(d.resumen || null);
    } catch (e) { showToast(String(e), "err"); }
    finally { setLoadingStock(false); }
  }, [stockQuery]);

  const cargarKardex = useCallback(async () => {
    setLoadingKardex(true);
    try {
      const r = await fetch(`/api/gestion-inventario/kardex${kardexQuery}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar kardex");
      setKardex(d.movimientos || []);
    } catch (e) { showToast(String(e), "err"); }
    finally { setLoadingKardex(false); }
  }, [kardexQuery]);

  useEffect(() => {
    if (!usuario) return;
    cargarBodegas();
    cargarProductos();
    cargarStock();
  }, [usuario, cargarBodegas, cargarProductos, cargarStock]);

  useEffect(() => {
    if (!usuario || tab !== "kardex") return;
    cargarKardex();
  }, [usuario, tab, cargarKardex]);

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
      const res = await fetch("/api/inventario/entrada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_bodega: Number(entradaForm.id_bodega), id_producto: Number(entradaForm.id_producto), cantidad: Number(entradaForm.cantidad), tipo_ingreso: entradaForm.tipo_ingreso, descripcion: entradaForm.descripcion }),
      });
      const data = await res.json();
      if (!res.ok) { setEntradaError(data.error || "Error desconocido"); }
      else {
        setEntradaResultado(data.stock);
        setEntradaForm(f => ({ ...f, id_producto: "", cantidad: "", tipo_ingreso: "UNIDADES", descripcion: "" }));
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!usuario) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;

  const productoSeleccionado = productos.find(p => p.id_producto === Number(entradaForm.id_producto));

  return (
    <StaffShell
      usuario={usuario}
      title="Inventario"
      subtitle={resumen ? `${resumen.filas} filas · alertas: ${resumen.bajo_minimo}` : "Stock, entradas, transferencias, ajustes y bodegas"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* ── Tabs ── */}
        <div style={s.card}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {([
              ["stock",       "Stock"],
              ["operaciones", "Operaciones"],
              ["kardex",      "Kardex"],
              ["bodegas",     "Bodegas"],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)} style={{ ...s.tabBtn, borderColor: tab === k ? "rgba(45,106,79,.55)" : "var(--border)", background: tab === k ? "rgba(45,106,79,.12)" : "transparent", color: tab === k ? "var(--text)" : "var(--muted)" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Filtros comunes (stock y kardex) */}
          {(tab === "stock" || tab === "kardex") && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <select value={filtroBodega} onChange={e => setFiltroBodega(e.target.value)} style={s.select}>
                <option value="">Todas las bodegas</option>
                {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
              </select>
              <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)} style={{ ...s.select, minWidth: 260 }}>
                <option value="">Todos los productos</option>
                {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}{!p.estado_producto ? " (inactivo)" : ""}</option>)}
              </select>
              {tab === "stock" && (
                <>
                  <label style={s.check}><input type="checkbox" checked={soloBajoMinimo} onChange={e => setSoloBajoMinimo(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Solo bajo mínimo</label>
                  <label style={s.check}><input type="checkbox" checked={incluirInactivos} onChange={e => setIncluirInactivos(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Incluir inactivos</label>
                </>
              )}
              <button type="button" onClick={() => tab === "stock" ? cargarStock() : cargarKardex()} style={s.btnGhost} disabled={loadingStock || loadingKardex}>
                {(loadingStock || loadingKardex) ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: STOCK
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "stock" && (
          <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  <th style={s.th}>Bodega</th>
                  <th style={s.th}>Producto</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Stock</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Mínimo</th>
                  <th style={s.th}>Alerta</th>
                  <th style={s.th}>Última act.</th>
                  <th style={s.th}>Guardar mínimo</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No hay filas para estos filtros.</td></tr>
                ) : stock.map(r => {
                  const key = `${r.id_bodega}:${r.id_producto}`;
                  const minVal = minEdits[key] ?? String(r.stock_minimo);
                  return (
                    <tr key={key} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}>{r.nombre_bodega}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{r.ubicacion || "—"}</div>
                      </td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}><code style={s.code}>{r.codigo_producto}</code> {r.nombre_producto}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{r.nombre_categoria} · {r.nombre_marca} · {r.unidad_medida}{!r.estado_producto ? " · inactivo" : ""}</div>
                      </td>
                      <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(r.cantidad_disponible).toFixed(3)}</td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        <input value={minVal} onChange={e => setMinEdits(m => ({ ...m, [key]: e.target.value }))} style={{ ...s.select, padding: "0.45rem 0.55rem", maxWidth: 120, textAlign: "right" }} />
                      </td>
                      <td style={s.td}>{r.bajo_minimo ? <span style={s.badgeWarn}>Bajo mínimo</span> : <span style={s.badgeOk}>OK</span>}</td>
                      <td style={{ ...s.td, fontSize: "0.82rem", color: "var(--muted)" }}>{new Date(r.ultima_actualizacion).toLocaleString("es-GT")}</td>
                      <td style={s.td}>
                        <button type="button" style={s.btnPrimary} onClick={() => void patchMinimo(r.id_bodega, r.id_producto)}>Guardar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: OPERACIONES
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "operaciones" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>

            {/* Entrada de stock */}
            <div style={s.card}>
              <h3 style={s.h3}>📦 Entrada de stock</h3>
              <p style={s.help}>Registra el ingreso de mercancía. Queda trazado en kardex.</p>
              <div style={s.field}>
                <label style={s.label}>Bodega *</label>
                <select value={entradaForm.id_bodega} onChange={e => { setEntradaForm(f => ({ ...f, id_bodega: e.target.value })); setEntradaError(null); setEntradaResultado(null); }} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Producto *</label>
                <select value={entradaForm.id_producto} onChange={e => { setEntradaForm(f => ({ ...f, id_producto: e.target.value })); setEntradaError(null); setEntradaResultado(null); }} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
                </select>
                {productoSeleccionado && <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Unidad: <strong style={{ color: "var(--text)" }}>{productoSeleccionado.unidad_medida}</strong></span>}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ ...s.field, flex: "1 1 120px" }}>
                  <label style={s.label}>Tipo *</label>
                  <select value={entradaForm.tipo_ingreso} onChange={e => setEntradaForm(f => ({ ...f, tipo_ingreso: e.target.value }))} style={s.select}>
                    <option value="UNIDADES">Unidades</option>
                    <option value="CAJAS">Cajas</option>
                  </select>
                </div>
                <div style={{ ...s.field, flex: "1 1 120px" }}>
                  <label style={s.label}>Cantidad *</label>
                  <input type="number" min="0.001" step="0.001" value={entradaForm.cantidad} onChange={e => setEntradaForm(f => ({ ...f, cantidad: e.target.value }))} style={s.select} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Descripción (opcional)</label>
                <textarea value={entradaForm.descripcion} onChange={e => setEntradaForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} placeholder="Ej: Compra a proveedor XYZ…" style={{ ...s.select, resize: "vertical" }} />
              </div>
              <button type="button" onClick={registrarEntrada} disabled={entradaLoading || !entradaForm.id_bodega || !entradaForm.id_producto || !entradaForm.cantidad} style={{ ...s.btnPrimary, opacity: (!entradaForm.id_bodega || !entradaForm.id_producto || !entradaForm.cantidad) ? 0.5 : 1 }}>
                {entradaLoading ? "Registrando…" : "Registrar entrada"}
              </button>
              {entradaError && <div style={s.alertErr}>{entradaError}</div>}
              {entradaResultado && (
                <div style={s.alertOk}>
                  <strong style={{ color: "var(--text)" }}>Entrada registrada</strong>
                  <div style={{ fontSize: "0.82rem", marginTop: "0.35rem", color: "var(--muted)" }}>
                    {entradaResultado.nombre_producto} · {entradaResultado.nombre_bodega}<br />
                    Stock actual: <strong style={{ color: "var(--text)" }}>{Number(entradaResultado.cantidad_disponible).toFixed(2)} {entradaResultado.unidad_medida}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Transferencia */}
            <div style={s.card}>
              <h3 style={s.h3}>🔄 Transferencia entre bodegas</h3>
              <p style={s.help}>Descuenta en origen, suma en destino y genera 2 movimientos en kardex.</p>
              <div style={s.field}>
                <label style={s.label}>Bodega origen</label>
                <select value={xfer.id_bodega_origen} onChange={e => setXfer(x => ({ ...x, id_bodega_origen: e.target.value }))} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Bodega destino</label>
                <select value={xfer.id_bodega_destino} onChange={e => setXfer(x => ({ ...x, id_bodega_destino: e.target.value }))} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Producto</label>
                <select value={xfer.id_producto} onChange={e => setXfer(x => ({ ...x, id_producto: e.target.value }))} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Cantidad</label>
                <input value={xfer.cantidad} onChange={e => setXfer(x => ({ ...x, cantidad: e.target.value }))} style={s.select} inputMode="decimal" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Descripción (opcional)</label>
                <input value={xfer.descripcion} onChange={e => setXfer(x => ({ ...x, descripcion: e.target.value }))} style={s.select} placeholder="Ej: Reubicación por temporada" />
              </div>
              <button type="button" style={s.btnPrimary} onClick={() => void registrarTransferencia()} disabled={!xfer.id_bodega_origen || !xfer.id_bodega_destino || !xfer.id_producto || !xfer.cantidad}>
                Registrar transferencia
              </button>
            </div>

            {/* Ajuste */}
            <div style={s.card}>
              <h3 style={s.h3}>⚖️ Ajuste de inventario</h3>
              <p style={s.help}>Define el <strong>stock real</strong> en una bodega. El delta se registra como <code style={s.code}>AJUSTE</code> en kardex.</p>
              <div style={s.field}>
                <label style={s.label}>Bodega</label>
                <select value={adj.id_bodega} onChange={e => setAdj(a => ({ ...a, id_bodega: e.target.value }))} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {bodegasSimple.map(b => <option key={b.id_bodega} value={b.id_bodega}>{b.nombre_bodega}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Producto</label>
                <select value={adj.id_producto} onChange={e => setAdj(a => ({ ...a, id_producto: e.target.value }))} style={s.select}>
                  <option value="">— Selecciona —</option>
                  {productos.map(p => <option key={p.id_producto} value={p.id_producto}>[{p.codigo_producto}] {p.nombre_producto}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Nueva cantidad (stock físico)</label>
                <input value={adj.nueva_cantidad} onChange={e => setAdj(a => ({ ...a, nueva_cantidad: e.target.value }))} style={s.select} inputMode="decimal" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Motivo / nota (opcional)</label>
                <input value={adj.descripcion} onChange={e => setAdj(a => ({ ...a, descripcion: e.target.value }))} style={s.select} placeholder="Ej: Conteo físico, merma…" />
              </div>
              <button type="button" style={s.btnPrimary} onClick={() => void registrarAjuste()} disabled={!adj.id_bodega || !adj.id_producto || !adj.nueva_cantidad}>
                Aplicar ajuste
              </button>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: KARDEX
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "kardex" && (
          <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  <th style={s.th}>Fecha</th>
                  <th style={s.th}>Tipo</th>
                  <th style={s.th}>Bodega</th>
                  <th style={s.th}>Producto</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Cantidad</th>
                  <th style={s.th}>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {kardex.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No hay movimientos para estos filtros.</td></tr>
                ) : kardex.map(m => (
                  <tr key={m.id_kardex} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...s.td, fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(m.fecha_movimiento).toLocaleString("es-GT")}</td>
                    <td style={s.td}><span style={tipoBadge(m.tipo_movimiento)}>{m.tipo_movimiento}</span></td>
                    <td style={s.td}><div style={{ fontWeight: 600 }}>{m.nombre_bodega}</div></td>
                    <td style={s.td}><div style={{ fontWeight: 600 }}><code style={s.code}>{m.codigo_producto}</code> {m.nombre_producto}</div><div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{m.unidad_medida}</div></td>
                    <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(m.cantidad).toFixed(3)}</td>
                    <td style={{ ...s.td, color: "var(--muted)", fontSize: "0.88rem" }}>{m.descripcion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: BODEGAS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "bodegas" && (
          <>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.25rem" }}>
              <button type="button" onClick={abrirCrearBodega} style={s.btnPrimary}>+ Nueva bodega</button>
              <button type="button" onClick={() => cargarBodegas()} style={s.btnGhost}>Actualizar</button>
            </div>
            <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    <th style={s.th}>ID</th>
                    <th style={s.th}>Nombre</th>
                    <th style={s.th}>Ubicación</th>
                    <th style={{ ...s.th, textAlign: "right" }}>Productos</th>
                    <th style={{ ...s.th, textAlign: "right" }}>Stock total</th>
                    <th style={{ ...s.th, textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bodegas.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No hay bodegas registradas.</td></tr>
                  ) : bodegas.map((b, i) => (
                    <tr key={b.id_bodega} style={{ background: i % 2 === 0 ? "var(--surface2)" : "var(--surface)" }}>
                      <td style={{ ...s.td, color: "var(--muted)", fontFamily: "monospace" }}>#{b.id_bodega}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{b.nombre_bodega}</td>
                      <td style={{ ...s.td, color: "var(--muted)" }}>{b.ubicacion || "—"}</td>
                      <td style={{ ...s.td, textAlign: "right" }}>{b.total_productos}</td>
                      <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(b.stock_total).toLocaleString("es-GT", { maximumFractionDigits: 3 })}</td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                          <button type="button" onClick={() => abrirEditarBodega(b)} style={s.btnEdit} title="Editar">✏️</button>
                          <button type="button" onClick={() => setConfirmDeleteBodega(b.id_bodega)} style={s.btnDel} title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

      {/* ── Modal Bodega ── */}
      {modalBodegaOpen && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) cerrarModalBodega(); }}>
          <div style={{ ...s.modal, maxWidth: 480 }}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editandoBodega ? "Editar bodega" : "Nueva bodega"}</h2>
              <button type="button" onClick={cerrarModalBodega} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.field}>
                <label style={s.label}>Nombre *</label>
                <input style={s.inputModal} value={bodegaForm.nombre_bodega} onChange={e => setBodegaForm(f => ({ ...f, nombre_bodega: e.target.value }))} placeholder="Bodega Principal" autoFocus />
              </div>
              <div style={s.field}>
                <label style={s.label}>Ubicación</label>
                <input style={s.inputModal} value={bodegaForm.ubicacion} onChange={e => setBodegaForm(f => ({ ...f, ubicacion: e.target.value }))} placeholder="Zona 1, Guatemala" />
              </div>
              {bodegaFormError && <p style={{ color: "var(--red)", fontSize: "0.85rem", margin: 0 }}>{bodegaFormError}</p>}
            </div>
            <div style={s.modalFooter}>
              <button type="button" onClick={cerrarModalBodega} style={s.btnSecondary} disabled={savingBodega}>Cancelar</button>
              <button type="button" onClick={handleGuardarBodega} style={s.btnPrimary} disabled={savingBodega}>{savingBodega ? "Guardando…" : editandoBodega ? "Guardar cambios" : "Crear bodega"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete bodega ── */}
      {confirmDeleteBodega !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.modalHeader}><h2 style={s.modalTitle}>¿Eliminar bodega?</h2></div>
            <div style={s.modalBody}>
              <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>Solo se puede eliminar si la bodega <strong style={{ color: "var(--text)" }}>no tiene stock activo</strong>. Si tiene productos, transfiere o ajusta el inventario primero.</p>
            </div>
            <div style={s.modalFooter}>
              <button type="button" onClick={() => setConfirmDeleteBodega(null)} style={s.btnSecondary} disabled={deletingBodega}>Cancelar</button>
              <button type="button" onClick={() => handleEliminarBodega(confirmDeleteBodega)} style={{ ...s.btnPrimary, background: "var(--red)" }} disabled={deletingBodega}>{deletingBodega ? "Eliminando…" : "Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...s.toast, background: toast.tipo === "ok" ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)", borderColor: toast.tipo === "ok" ? "rgba(63,185,80,.4)" : "rgba(248,81,73,.4)", color: toast.tipo === "ok" ? "var(--green)" : "var(--red)" }}>
          {toast.msg}
        </div>
      )}
    </StaffShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tipoBadge(tipo: KardexRow["tipo_movimiento"]): CSSProperties {
  if (tipo === "ENTRADA") return { ...pill, background: "rgba(63,185,80,.12)", borderColor: "rgba(63,185,80,.35)", color: "var(--green)" };
  if (tipo === "SALIDA")  return { ...pill, background: "rgba(248,81,73,.10)", borderColor: "rgba(248,81,73,.30)", color: "var(--red)" };
  return { ...pill, background: "rgba(88,166,255,.12)", borderColor: "rgba(88,166,255,.30)", color: "var(--blue)" };
}

const pill: CSSProperties = { display: "inline-block", padding: "0.15rem 0.55rem", borderRadius: 999, border: "1px solid var(--border)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.04em" };

// ── Estilos ───────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" },
  tabBtn: { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", borderRadius: 999, padding: "0.45rem 0.85rem", cursor: "pointer", fontSize: "0.85rem" },
  select: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.55rem 0.75rem", color: "var(--text)", fontSize: "0.9rem", outline: "none", width: "100%" },
  check: { display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--muted)", fontSize: "0.85rem", userSelect: "none" } as CSSProperties,
  btnGhost: { border: "1px solid var(--border)", background: "transparent", color: "var(--text)", borderRadius: 10, padding: "0.55rem 0.85rem", cursor: "pointer", fontSize: "0.85rem" },
  btnPrimary: { background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 10, padding: "0.65rem 0.9rem", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem", whiteSpace: "nowrap" } as CSSProperties,
  btnSecondary: { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.6rem 1.2rem", fontSize: "0.88rem", cursor: "pointer" },
  btnEdit: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.85rem" },
  btnDel: { background: "rgba(248,81,73,.1)", border: "1px solid rgba(248,81,73,.25)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.85rem" },
  th: { textAlign: "left", padding: "0.75rem 0.85rem", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" } as CSSProperties,
  td: { padding: "0.75rem 0.85rem", verticalAlign: "top" },
  code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "0.78rem", padding: "0.1rem 0.35rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--accent)" },
  badgeOk: { display: "inline-block", padding: "0.15rem 0.55rem", borderRadius: 999, border: "1px solid rgba(63,185,80,.35)", background: "rgba(63,185,80,.10)", color: "var(--green)", fontSize: "0.78rem", fontWeight: 700 },
  badgeWarn: { display: "inline-block", padding: "0.15rem 0.55rem", borderRadius: 999, border: "1px solid rgba(232,160,69,.35)", background: "rgba(232,160,69,.10)", color: "var(--accent)", fontSize: "0.78rem", fontWeight: 700 },
  h3: { margin: "0 0 0.35rem", fontFamily: "var(--font-head)", fontSize: "1.05rem" },
  help: { margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.55 },
  field: { display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.85rem" },
  label: { fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)" },
  alertErr: { marginTop: "0.75rem", background: "rgba(248,81,73,.12)", border: "1px solid rgba(248,81,73,.3)", borderRadius: 8, padding: "0.65rem 0.85rem", color: "var(--red)", fontSize: "0.85rem" },
  alertOk: { marginTop: "0.75rem", background: "rgba(63,185,80,.12)", border: "1px solid rgba(63,185,80,.35)", borderRadius: 8, padding: "0.75rem 0.85rem", color: "var(--green)", fontSize: "0.85rem" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem" } as CSSProperties,
  modal: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "var(--shadow)", overflow: "hidden" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" },
  modalTitle: { fontFamily: "var(--font-head)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: 0 },
  closeBtn: { background: "transparent", border: "none", color: "var(--muted)", fontSize: "1rem", cursor: "pointer", padding: "0.2rem 0.4rem" },
  modalBody: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" } as CSSProperties,
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" },
  inputModal: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.65rem 0.85rem", color: "var(--text)", fontSize: "0.92rem", outline: "none", width: "100%" },
  toast: { position: "fixed", bottom: "2rem", right: "2rem", padding: "0.85rem 1.25rem", borderRadius: "var(--radius)", border: "1px solid", fontSize: "0.88rem", fontWeight: 500, zIndex: 300, backdropFilter: "blur(8px)", boxShadow: "var(--shadow)" } as CSSProperties,
};