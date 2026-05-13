"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { useDuenoSession } from "@/hooks/useDuenoSession";

type Bodega = { id_bodega: number; nombre_bodega: string; ubicacion: string | null };
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

type TabKey = "stock" | "movimientos" | "operaciones";

export default function GestionInventarioPage() {
  const usuario = useDuenoSession();

  const [tab, setTab] = useState<TabKey>("stock");

  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  const [filtroBodega, setFiltroBodega] = useState<string>("");
  const [filtroProducto, setFiltroProducto] = useState<string>("");
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  const [stock, setStock] = useState<StockRow[]>([]);
  const [resumen, setResumen] = useState<{ filas: number; bajo_minimo: number } | null>(null);
  const [kardex, setKardex] = useState<KardexRow[]>([]);

  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const [minEdits, setMinEdits] = useState<Record<string, string>>({});

  const [xfer, setXfer] = useState({
    id_bodega_origen: "",
    id_bodega_destino: "",
    id_producto: "",
    cantidad: "",
    descripcion: "",
  });

  const [adj, setAdj] = useState({
    id_bodega: "",
    id_producto: "",
    nueva_cantidad: "",
    descripcion: "",
  });

  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

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
    const qs = p.toString();
    return qs ? `?${qs}` : "?limit=200";
  }, [filtroBodega, filtroProducto]);

  const cargarMaestros = useCallback(async () => {
    const [rb, rp] = await Promise.all([fetch("/api/bodegas"), fetch("/api/productos")]);
    const [db, dp] = await Promise.all([rb.json(), rp.json()]);
    if (!rb.ok) throw new Error(db.error || "No se pudieron cargar bodegas");
    if (!rp.ok) throw new Error(dp.error || "No se pudieron cargar productos");
    setBodegas(db.bodegas || []);
    setProductos(dp.productos || []);
  }, []);

  const cargarStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const r = await fetch(`/api/gestion-inventario${stockQuery}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar stock");
      setStock(d.stock || []);
      setResumen(d.resumen || null);
    } catch (e) {
      showToast(String(e), "err");
    } finally {
      setLoadingStock(false);
    }
  }, [stockQuery]);

  const cargarKardex = useCallback(async () => {
    setLoadingKardex(true);
    try {
      const r = await fetch(`/api/gestion-inventario/kardex${kardexQuery}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar kardex");
      setKardex(d.movimientos || []);
    } catch (e) {
      showToast(String(e), "err");
    } finally {
      setLoadingKardex(false);
    }
  }, [kardexQuery]);

  useEffect(() => {
    if (!usuario) return;
    cargarMaestros().catch((e) => showToast(String(e), "err"));
  }, [usuario, cargarMaestros]);

  useEffect(() => {
    if (!usuario) return;
    cargarStock();
  }, [usuario, cargarStock]);

  useEffect(() => {
    if (!usuario) return;
    if (tab !== "movimientos") return;
    cargarKardex();
  }, [usuario, tab, cargarKardex]);

  const patchMinimo = async (idBodega: number, idProducto: number) => {
    const key = `${idBodega}:${idProducto}`;
    const raw = (minEdits[key] ?? "").trim();
    const minimo = Number(raw);
    if (!Number.isFinite(minimo) || minimo < 0) {
      showToast("Stock mínimo inválido", "err");
      return;
    }

    try {
      const r = await fetch("/api/gestion-inventario/stock-minimo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_bodega: idBodega, id_producto: idProducto, stock_minimo: minimo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo actualizar");
      showToast("Stock mínimo actualizado", "ok");
      setMinEdits((m) => {
        const next = { ...m };
        delete next[key];
        return next;
      });
      await cargarStock();
    } catch (e) {
      showToast(String(e), "err");
    }
  };

  const registrarTransferencia = async () => {
    try {
      const r = await fetch("/api/gestion-inventario/transferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_bodega_origen: Number(xfer.id_bodega_origen),
          id_bodega_destino: Number(xfer.id_bodega_destino),
          id_producto: Number(xfer.id_producto),
          cantidad: Number(xfer.cantidad),
          descripcion: xfer.descripcion,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo transferir");
      showToast(d.mensaje || "Transferencia OK", "ok");
      setXfer((x) => ({ ...x, id_producto: "", cantidad: "", descripcion: "" }));
      await cargarStock();
      if (tab === "movimientos") await cargarKardex();
    } catch (e) {
      showToast(String(e), "err");
    }
  };

  const registrarAjuste = async () => {
    try {
      const r = await fetch("/api/gestion-inventario/ajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_bodega: Number(adj.id_bodega),
          id_producto: Number(adj.id_producto),
          nueva_cantidad: Number(adj.nueva_cantidad),
          descripcion: adj.descripcion,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo ajustar");
      showToast(d.mensaje || "Ajuste OK", "ok");
      setAdj((a) => ({ ...a, nueva_cantidad: "", descripcion: "" }));
      await cargarStock();
      if (tab === "movimientos") await cargarKardex();
    } catch (e) {
      showToast(String(e), "err");
    }
  };

  if (!usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <StaffShell
      usuario={usuario}
      title="Gestión de inventario"
      subtitle={
        resumen
          ? `${resumen.filas} filas${soloBajoMinimo ? " (solo bajo mínimo)" : ""} · alertas: ${resumen.bajo_minimo}`
          : "Stock por bodega, alertas, transferencias y ajustes"
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={card}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(
              [
                ["stock", "Stock por bodega"],
                ["movimientos", "Kardex"],
                ["operaciones", "Operaciones"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                style={{
                  ...tabBtn,
                  borderColor: tab === k ? "rgba(45,106,79,.55)" : "var(--border)",
                  background: tab === k ? "rgba(45,106,79,.12)" : "transparent",
                  color: tab === k ? "var(--text)" : "var(--muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <select
              value={filtroBodega}
              onChange={(e) => setFiltroBodega(e.target.value)}
              style={input}
            >
              <option value="">Todas las bodegas</option>
              {bodegas.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.nombre_bodega}
                </option>
              ))}
            </select>

            <select
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              style={{ ...input, minWidth: 280 }}
            >
              <option value="">Todos los productos</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  [{p.codigo_producto}] {p.nombre_producto}
                  {!p.estado_producto ? " (inactivo)" : ""}
                </option>
              ))}
            </select>

            <label style={check}>
              <input
                type="checkbox"
                checked={soloBajoMinimo}
                onChange={(e) => setSoloBajoMinimo(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Solo bajo mínimo
            </label>

            <label style={check}>
              <input
                type="checkbox"
                checked={incluirInactivos}
                onChange={(e) => setIncluirInactivos(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Incluir inactivos
            </label>

            <button type="button" onClick={() => void cargarStock()} style={btnGhost} disabled={loadingStock}>
              {loadingStock ? "Actualizando…" : "Actualizar stock"}
            </button>

            {tab === "movimientos" && (
              <button type="button" onClick={() => void cargarKardex()} style={btnGhost} disabled={loadingKardex}>
                {loadingKardex ? "Actualizando…" : "Actualizar kardex"}
              </button>
            )}
          </div>
        </div>

        {tab === "stock" && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  <th style={th}>Bodega</th>
                  <th style={th}>Producto</th>
                  <th style={{ ...th, textAlign: "right" }}>Stock</th>
                  <th style={{ ...th, textAlign: "right" }}>Mínimo</th>
                  <th style={th}>Alerta</th>
                  <th style={th}>Última act.</th>
                  <th style={th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...td, textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                      No hay filas para estos filtros.
                    </td>
                  </tr>
                ) : (
                  stock.map((r) => {
                    const key = `${r.id_bodega}:${r.id_producto}`;
                    const minVal =
                      minEdits[key] ??
                      (typeof r.stock_minimo === "string" ? r.stock_minimo : String(r.stock_minimo));
                    return (
                      <tr key={key} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{r.nombre_bodega}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{r.ubicacion || "—"}</div>
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>
                            <code style={code}>{r.codigo_producto}</code> {r.nombre_producto}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                            {r.nombre_categoria} · {r.nombre_marca} · {r.unidad_medida}
                            {!r.estado_producto ? " · inactivo" : ""}
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {Number(r.cantidad_disponible).toFixed(3)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <input
                            value={minVal}
                            onChange={(e) => setMinEdits((m) => ({ ...m, [key]: e.target.value }))}
                            style={{ ...input, padding: "0.45rem 0.55rem", maxWidth: 140 }}
                          />
                        </td>
                        <td style={td}>
                          {r.bajo_minimo ? (
                            <span style={badgeWarn}>Bajo mínimo</span>
                          ) : (
                            <span style={badgeOk}>OK</span>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: "0.82rem", color: "var(--muted)" }}>
                          {new Date(r.ultima_actualizacion).toLocaleString("es-GT")}
                        </td>
                        <td style={td}>
                          <button
                            type="button"
                            style={btnPrimary}
                            onClick={() => void patchMinimo(r.id_bodega, r.id_producto)}
                          >
                            Guardar mínimo
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "movimientos" && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  <th style={th}>Fecha</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Bodega</th>
                  <th style={th}>Producto</th>
                  <th style={{ ...th, textAlign: "right" }}>Cantidad</th>
                  <th style={th}>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {kardex.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...td, textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                      No hay movimientos para estos filtros.
                    </td>
                  </tr>
                ) : (
                  kardex.map((m) => (
                    <tr key={m.id_kardex} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {new Date(m.fecha_movimiento).toLocaleString("es-GT")}
                      </td>
                      <td style={td}>
                        <span style={tipoBadge(m.tipo_movimiento)}>{m.tipo_movimiento}</span>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{m.nombre_bodega}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>#{m.id_bodega}</div>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>
                          <code style={code}>{m.codigo_producto}</code> {m.nombre_producto}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{m.unidad_medida}</div>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {Number(m.cantidad).toFixed(3)}
                      </td>
                      <td style={{ ...td, color: "var(--muted)", fontSize: "0.88rem" }}>{m.descripcion || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "operaciones" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
            <div style={card}>
              <h3 style={h3}>Transferencia entre bodegas</h3>
              <p style={help}>Descuenta en origen, suma en destino y genera 2 movimientos en kardex.</p>

              <div style={field}>
                <label style={label}>Bodega origen</label>
                <select
                  value={xfer.id_bodega_origen}
                  onChange={(e) => setXfer({ ...xfer, id_bodega_origen: e.target.value })}
                  style={input}
                >
                  <option value="">— Selecciona —</option>
                  {bodegas.map((b) => (
                    <option key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre_bodega}
                    </option>
                  ))}
                </select>
              </div>

              <div style={field}>
                <label style={label}>Bodega destino</label>
                <select
                  value={xfer.id_bodega_destino}
                  onChange={(e) => setXfer({ ...xfer, id_bodega_destino: e.target.value })}
                  style={input}
                >
                  <option value="">— Selecciona —</option>
                  {bodegas.map((b) => (
                    <option key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre_bodega}
                    </option>
                  ))}
                </select>
              </div>

              <div style={field}>
                <label style={label}>Producto</label>
                <select
                  value={xfer.id_producto}
                  onChange={(e) => setXfer({ ...xfer, id_producto: e.target.value })}
                  style={input}
                >
                  <option value="">— Selecciona —</option>
                  {productos.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>
                      [{p.codigo_producto}] {p.nombre_producto}
                    </option>
                  ))}
                </select>
              </div>

              <div style={field}>
                <label style={label}>Cantidad</label>
                <input
                  value={xfer.cantidad}
                  onChange={(e) => setXfer({ ...xfer, cantidad: e.target.value })}
                  style={input}
                  inputMode="decimal"
                />
              </div>

              <div style={field}>
                <label style={label}>Descripción (opcional)</label>
                <input
                  value={xfer.descripcion}
                  onChange={(e) => setXfer({ ...xfer, descripcion: e.target.value })}
                  style={input}
                  placeholder="Ej: Reubicación por temporada"
                />
              </div>

              <button
                type="button"
                style={btnPrimary}
                onClick={() => void registrarTransferencia()}
                disabled={!xfer.id_bodega_origen || !xfer.id_bodega_destino || !xfer.id_producto || !xfer.cantidad}
              >
                Registrar transferencia
              </button>
            </div>

            <div style={card}>
              <h3 style={h3}>Ajuste de inventario</h3>
              <p style={help}>
                Define el <strong>stock real</strong> en una bodega. El sistema calcula el delta y lo registra como{" "}
                <code style={code}>AJUSTE</code> en kardex.
              </p>

              <div style={field}>
                <label style={label}>Bodega</label>
                <select
                  value={adj.id_bodega}
                  onChange={(e) => setAdj({ ...adj, id_bodega: e.target.value })}
                  style={input}
                >
                  <option value="">— Selecciona —</option>
                  {bodegas.map((b) => (
                    <option key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre_bodega}
                    </option>
                  ))}
                </select>
              </div>

              <div style={field}>
                <label style={label}>Producto</label>
                <select
                  value={adj.id_producto}
                  onChange={(e) => setAdj({ ...adj, id_producto: e.target.value })}
                  style={input}
                >
                  <option value="">— Selecciona —</option>
                  {productos.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>
                      [{p.codigo_producto}] {p.nombre_producto}
                    </option>
                  ))}
                </select>
              </div>

              <div style={field}>
                <label style={label}>Nueva cantidad (stock físico)</label>
                <input
                  value={adj.nueva_cantidad}
                  onChange={(e) => setAdj({ ...adj, nueva_cantidad: e.target.value })}
                  style={input}
                  inputMode="decimal"
                />
              </div>

              <div style={field}>
                <label style={label}>Motivo / nota (opcional)</label>
                <input
                  value={adj.descripcion}
                  onChange={(e) => setAdj({ ...adj, descripcion: e.target.value })}
                  style={input}
                  placeholder="Ej: Conteo físico, merma, corrección"
                />
              </div>

              <button
                type="button"
                style={btnPrimary}
                onClick={() => void registrarAjuste()}
                disabled={!adj.id_bodega || !adj.id_producto || !adj.nueva_cantidad}
              >
                Aplicar ajuste
              </button>

              <p style={{ ...help, marginTop: "0.75rem" }}>
                Tip: para compras/ingresos normales usa <strong>/inventario/entrada</strong> (también dueño).
              </p>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            padding: "0.85rem 1.25rem",
            borderRadius: "var(--radius)",
            border: "1px solid",
            fontSize: "0.88rem",
            fontWeight: 500,
            zIndex: 300,
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow)",
            background: toast.tipo === "ok" ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)",
            borderColor: toast.tipo === "ok" ? "rgba(63,185,80,.4)" : "rgba(248,81,73,.4)",
            color: toast.tipo === "ok" ? "var(--green)" : "var(--red)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </StaffShell>
  );
}

function tipoBadge(tipo: KardexRow["tipo_movimiento"]): CSSProperties {
  if (tipo === "ENTRADA") return { ...pill, background: "rgba(63,185,80,.12)", borderColor: "rgba(63,185,80,.35)", color: "var(--green)" };
  if (tipo === "SALIDA") return { ...pill, background: "rgba(248,81,73,.10)", borderColor: "rgba(248,81,73,.30)", color: "var(--red)" };
  return { ...pill, background: "rgba(88,166,255,.12)", borderColor: "rgba(88,166,255,.30)", color: "var(--blue)" };
}

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1rem",
};

const tabBtn: CSSProperties = {
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  borderRadius: 999,
  padding: "0.45rem 0.85rem",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const input: CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "0.55rem 0.75rem",
  color: "var(--text)",
  fontSize: "0.9rem",
  outline: "none",
};

const check: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  color: "var(--muted)",
  fontSize: "0.85rem",
  userSelect: "none",
};

const btnGhost: CSSProperties = {
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  borderRadius: 10,
  padding: "0.55rem 0.85rem",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const btnPrimary: CSSProperties = {
  background: "var(--accent)",
  color: "#0d1117",
  border: "none",
  borderRadius: 10,
  padding: "0.65rem 0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 0.85rem",
  fontSize: "0.72rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "0.75rem 0.85rem",
  verticalAlign: "top",
};

const code: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.78rem",
  padding: "0.1rem 0.35rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--accent)",
};

const badgeOk: CSSProperties = {
  display: "inline-block",
  padding: "0.15rem 0.55rem",
  borderRadius: 999,
  border: "1px solid rgba(63,185,80,.35)",
  background: "rgba(63,185,80,.10)",
  color: "var(--green)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const badgeWarn: CSSProperties = {
  display: "inline-block",
  padding: "0.15rem 0.55rem",
  borderRadius: 999,
  border: "1px solid rgba(232,160,69,.35)",
  background: "rgba(232,160,69,.10)",
  color: "var(--accent)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const pill: CSSProperties = {
  display: "inline-block",
  padding: "0.15rem 0.55rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
};

const h3: CSSProperties = {
  margin: "0 0 0.35rem",
  fontFamily: "var(--font-head)",
  fontSize: "1.05rem",
};

const help: CSSProperties = {
  margin: "0 0 1rem",
  color: "var(--muted)",
  fontSize: "0.88rem",
  lineHeight: 1.55,
};

const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  marginBottom: "0.85rem",
};

const label: CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 700,
  color: "var(--muted)",
};
