import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import { muestraAleatoria, normalizarTexto } from "@/components/ProductoAutocompletar";

type Categoria = { id_categoria: number; nombre_categoria: string };
type Props = {
  categorias: Categoria[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  opcional?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
};

export function CategoriaAutocompletar({ categorias, value, onChange, ariaLabel, opcional = false, disabled, style }: Props) {
  const listaId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [muestra, setMuestra] = useState<Categoria[]>([]);
  const [activa, setActiva] = useState(0);
  const seleccionada = categorias.find((c) => String(c.id_categoria) === value);

  useEffect(() => { setMuestra(muestraAleatoria(categorias, 5)); }, [categorias]);

  const q = normalizarTexto(query?.trim() ?? "");
  const lista = q
    ? categorias.filter((c) => normalizarTexto(c.nombre_categoria).includes(q))
      .sort((a, b) => a.nombre_categoria.localeCompare(b.nombre_categoria)).slice(0, 8)
    : muestra;
  const indice = Math.max(0, Math.min(activa, Math.max(0, lista.length - 1)));
  const cerrar = () => { setAbierto(false); setQuery(null); };
  const elegir = (id: string) => { onChange(id); cerrar(); };
  const abrir = () => {
    setMuestra(muestraAleatoria(categorias, 5));
    setQuery("");
    setActiva(0);
    setAbierto(true);
  };

  return (
    <div style={{ position: "relative", minWidth: 0 }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) cerrar(); }}>
      <input
        role="combobox" aria-label={ariaLabel} aria-expanded={abierto && !disabled}
        aria-controls={listaId} aria-autocomplete="list"
        aria-activedescendant={abierto && lista.length ? `${listaId}-${indice}` : undefined}
        autoComplete="off" disabled={disabled} style={style}
        placeholder={opcional ? "Sin categoría" : "Busca una categoría…"}
        value={query ?? seleccionada?.nombre_categoria ?? ""}
        onFocus={abrir}
        onClick={() => { if (!abierto) abrir(); }}
        onChange={(e) => { setQuery(e.target.value); setActiva(0); setAbierto(true); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); cerrar(); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!abierto) abrir();
            else setActiva(e.key === "ArrowDown" ? Math.max(0, Math.min(indice + 1, lista.length - 1)) : Math.max(0, indice - 1));
          }
          if (e.key === "Enter" && abierto) {
            e.preventDefault();
            if (lista[indice]) elegir(String(lista[indice].id_categoria));
          }
        }}
      />
      {abierto && !disabled && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "var(--surface, white)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 10px rgba(0,0,0,.12)" }}>
          <p style={{ padding: "0.4rem 0.65rem", margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>
            {q ? "Coincidencias" : "Sugeridas · escribe para ver más"}
          </p>
          <div id={listaId} role="listbox" aria-label={`Opciones de ${ariaLabel}`} style={{ maxHeight: 240, overflowY: "auto" }}>
            {lista.map((c, i) => (
              <button key={c.id_categoria} id={`${listaId}-${i}`} type="button" role="option" tabIndex={-1}
                aria-selected={String(c.id_categoria) === value}
                onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(String(c.id_categoria))}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.65rem", border: 0, borderTop: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", background: i === indice ? "var(--surface2)" : "transparent" }}>
                {c.nombre_categoria}
              </button>
            ))}
          </div>
          {lista.length === 0 && <p style={{ padding: "0.5rem 0.65rem", margin: 0, fontSize: "0.8rem" }}>Sin resultados. Puedes crear una categoría.</p>}
          {opcional && (
            <button type="button" aria-label={`Dejar ${ariaLabel} sin categoría`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => elegir("")}
              style={{ padding: "0.6rem", width: "100%", textAlign: "left", border: 0, borderTop: "1px solid var(--border)", color: "var(--muted)", background: "transparent", cursor: "pointer" }}>
              Sin categoría
            </button>
          )}
        </div>
      )}
    </div>
  );
}
