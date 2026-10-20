import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { muestraAleatoria } from "@/components/ProductoAutocompletar";
import { normalizarPresentacion, sugerenciasPresentaciones, validarPresentaciones, type Presentacion } from "@/lib/presentaciones";

type Props = {
  unidad: string;
  value: Presentacion[];
  onChange: (presentaciones: Presentacion[]) => void;
  disabled?: boolean;
};

export function PresentacionesProducto({ unidad, value, onChange, disabled }: Props) {
  const listaId = useId();
  const [catalogo, setCatalogo] = useState<Presentacion[]>([]);
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [muestra, setMuestra] = useState<Presentacion[]>([]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [factor, setFactor] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    setCatalogo(sugerenciasPresentaciones(unidad));
    setQuery("");
    setAbierto(false);
    setCreando(false);
    setNombre("");
    setFactor("");
    setError("");
    setAviso("");
    if (!unidad.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/presentaciones?unidad_medida=${encodeURIComponent(unidad.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) setCatalogo(data.presentaciones || []);
      } catch {
        if (!controller.signal.aborted) setAviso("No se pudo cargar el catálogo compartido. Puedes usar las sugerencias o crear una presentación.");
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [unidad]);

  const disponibles = useMemo(() => catalogo.filter((p) =>
    !value.some((e) => normalizarPresentacion(e.nombre_presentacion) === normalizarPresentacion(p.nombre_presentacion))
  ), [catalogo, value]);

  useEffect(() => { setMuestra(muestraAleatoria(disponibles, 5)); }, [disponibles]);

  const q = normalizarPresentacion(query);
  const lista = q
    ? disponibles.filter((p) => normalizarPresentacion(`${p.nombre_presentacion} ${p.factor_conversion} ${unidad}`).includes(q)).slice(0, 8)
    : muestra;

  const agregar = (p: Presentacion) => {
    onChange([...value, { nombre_presentacion: p.nombre_presentacion, factor_conversion: Number(p.factor_conversion) }]);
    setQuery("");
    setAbierto(false);
    setError("");
  };

  const crear = () => {
    const nueva = { nombre_presentacion: nombre.trim(), factor_conversion: Number(factor) };
    const validacion = validarPresentaciones([...value, nueva]);
    if (validacion) { setError(validacion); return; }
    agregar(nueva);
    setNombre("");
    setFactor("");
    setCreando(false);
  };

  return (
    <section aria-label="Presentaciones del producto" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
      <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.4rem" }}>Presentaciones</h3>
      <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 0.6rem" }}>
        {unidad.trim() ? `Cada equivalencia se expresa en ${unidad}. Selecciona o crea las presentaciones de este producto.` : "Indica primero la unidad base del producto."}
      </p>
      {value.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {value.map((p) => (
            <li key={normalizarPresentacion(p.nombre_presentacion)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", border: "1px solid var(--border)", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
              <span style={{ fontSize: "0.82rem" }}>{p.nombre_presentacion} · {Number(p.factor_conversion)} {unidad}</span>
              <button type="button" disabled={disabled} aria-label={`Quitar ${p.nombre_presentacion}`} onClick={() => onChange(value.filter((e) => e !== p))} style={boton}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false); }}>
          <input
            role="combobox" aria-label="Buscar presentaciones" aria-controls={listaId} aria-expanded={abierto} aria-autocomplete="list"
            placeholder="Buscar presentación por nombre o equivalencia…" autoComplete="off" style={campo}
            value={query} disabled={disabled || !unidad.trim()}
            onChange={(e) => { setQuery(e.target.value); setAbierto(true); }}
            onFocus={() => { setMuestra(muestraAleatoria(disponibles, 5)); setAbierto(true); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAbierto(false);
              if (e.key === "Enter" && abierto && lista.length) { e.preventDefault(); agregar(lista[0]); }
            }}
          />
          {abierto && !disabled && (
            <div id={listaId} role="listbox" aria-label="Presentaciones compatibles" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, maxHeight: 250, overflowY: "auto", background: "var(--surface, white)", border: "1px solid var(--border)", borderRadius: 8 }}>
              {!q && <p style={{ padding: "0.4rem 0.6rem", margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Sugerencias · escribe para ver más</p>}
              {lista.length === 0 && <p style={{ padding: "0.5rem", fontSize: "0.8rem" }}>Sin coincidencias. Puedes crear una presentación.</p>}
              {lista.map((p) => (
                <button key={`${p.nombre_presentacion}:${p.factor_conversion}`} type="button" role="option" aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(p)}
                  style={{ ...boton, display: "block", textAlign: "left", padding: "0.7rem", width: "100%", border: 0, borderTop: "1px solid var(--border)", borderRadius: 0 }}>
                  {p.nombre_presentacion} · {Number(p.factor_conversion)} {unidad}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" disabled={disabled || !unidad.trim()} onClick={() => { setCreando(!creando); setNombre(query); setAbierto(false); setError(""); }} style={boton}>+ Crear presentación</button>
      </div>
      {aviso && <p role="status" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{aviso}</p>}
      {creando && (
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ flex: "1 1 200px", fontSize: "0.8rem" }}>Nombre de presentación
            <input style={campo} maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={disabled} />
          </label>
          <label style={{ flex: "1 1 150px", fontSize: "0.8rem" }}>Equivalencia en {unidad}
            <input style={campo} type="number" min="0.001" max="999999999.999" step="0.001" value={factor} onChange={(e) => setFactor(e.target.value)} disabled={disabled} />
          </label>
          <button type="button" onClick={crear} disabled={disabled} style={boton}>Agregar al producto</button>
          <button type="button" onClick={() => { setCreando(false); setError(""); }} disabled={disabled} style={boton}>Cancelar presentación</button>
        </div>
      )}
      {error && <p role="alert" style={{ color: "var(--red)", fontSize: "0.82rem" }}>{error}</p>}
      <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginBottom: 0 }}>Los cambios en presentaciones se aplican al guardar el producto.</p>
    </section>
  );
}

const campo: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "0.6rem 0.7rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.85rem" };
const boton: CSSProperties = { padding: "0.5rem 0.7rem", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" };
