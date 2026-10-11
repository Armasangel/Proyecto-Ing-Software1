"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Selector de producto con sugerencias, para reemplazar los <select> con todo
 * el catálogo:
 *   - sin escribir nada muestra solo 5 productos al azar (se vuelven a sortear
 *     cada vez que se abre el campo, así a la larga se ven todos);
 *   - al escribir busca en TODO el catálogo (por nombre o código, sin importar
 *     mayúsculas ni acentos) y muestra hasta 8 coincidencias.
 *
 * Es "controlado" igual que el <select> que reemplaza: `value` es el id del
 * producto como string ("" = ninguno) y `onChange` entrega el id elegido.
 */

export type ProductoOpcion = {
  id_producto: number;
  nombre_producto: string;
  codigo_producto: string;
};

export const SUGERIDOS_POR_DEFECTO = 5;
const MAX_RESULTADOS = 8;

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function muestraAleatoria<T>(items: T[], n: number): T[] {
  const copia = [...items];
  // Fisher-Yates parcial: alcanza con barajar las primeras n posiciones.
  for (let i = 0; i < Math.min(n, copia.length); i++) {
    const j = i + Math.floor(Math.random() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, n);
}

type Props<T extends ProductoOpcion> = {
  /** Catálogo completo donde se busca al escribir. */
  productos: T[];
  /** Si se pasa, se muestran estos en vez de una muestra al azar del catálogo. */
  sugeridos?: T[];
  value: string;
  onChange: (idProducto: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  /** Estilo del contenedor (p. ej. `flex: 1` dentro de una fila). */
  wrapperStyle?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
  /** Texto gris junto al nombre (por defecto, el código). */
  detalle?: (p: T) => ReactNode;
  /** Mensaje cuando no hay nada que sugerir con el campo vacío. */
  mensajeVacio?: string;
};

const etiqueta = (p: ProductoOpcion) => `${p.nombre_producto} (${p.codigo_producto})`;

export function ProductoAutocompletar<T extends ProductoOpcion>({
  productos,
  sugeridos,
  value,
  onChange,
  placeholder = "Busca por nombre o código…",
  className,
  style,
  wrapperStyle,
  disabled,
  ariaLabel = "Producto",
  detalle,
  mensajeVacio = "Escribe para buscar un producto",
}: Props<T>) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [muestra, setMuestra] = useState<T[]>([]);

  // Último valor que emitimos nosotros: sirve para distinguir un cambio de
  // `value` hecho desde afuera (limpiar el formulario, precargar) de uno que
  // viene de lo que el usuario acaba de escribir.
  const ultimoEmitido = useRef(value);
  const productosRef = useRef(productos);
  productosRef.current = productos;

  const resortear = useCallback(() => {
    setMuestra(muestraAleatoria(productosRef.current, SUGERIDOS_POR_DEFECTO));
  }, []);

  // Se sortea de nuevo cuando llega (o cambia de tamaño) el catálogo.
  useEffect(() => {
    resortear();
  }, [productos.length, resortear]);

  // Cambios de `value` hechos desde afuera.
  useEffect(() => {
    if (value === ultimoEmitido.current) return;
    ultimoEmitido.current = value;
    const p = productosRef.current.find((x) => String(x.id_producto) === value);
    setTexto(p ? etiqueta(p) : "");
  }, [value, productos]);

  const emitir = (id: string) => {
    ultimoEmitido.current = id;
    onChange(id);
  };

  const q = normalizarTexto(texto.trim());
  const coincidencias =
    q === ""
      ? []
      : (() => {
          const posicion = new Map((sugeridos ?? []).map((p, i) => [p.id_producto, i]));
          return productos
            .filter((p) => normalizarTexto(p.nombre_producto).includes(q) || normalizarTexto(p.codigo_producto).includes(q))
            .sort((a, b) => {
              const pa = posicion.get(a.id_producto) ?? Infinity;
              const pb = posicion.get(b.id_producto) ?? Infinity;
              return pa !== pb ? pa - pb : a.nombre_producto.localeCompare(b.nombre_producto);
            })
            .slice(0, MAX_RESULTADOS);
        })();
  const lista = q === "" ? (sugeridos ?? muestra).slice(0, SUGERIDOS_POR_DEFECTO) : coincidencias;

  const elegir = (p: T) => {
    emitir(String(p.id_producto));
    setTexto(etiqueta(p));
    setAbierto(false);
  };

  return (
    <div style={{ position: "relative", minWidth: 0, ...wrapperStyle }}>
      <input
        type="text"
        className={className}
        style={style}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          if (value) emitir("");
        }}
        onFocus={() => {
          if (!value) resortear();
          setAbierto(true);
        }}
        onBlur={() => {
          // Si escribió algo que solo coincide con un producto, se da por
          // elegido (así no queda un texto "huérfano" sin producto asignado).
          if (!value && coincidencias.length === 1) elegir(coincidencias[0]);
          setTimeout(() => setAbierto(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          if (e.key === "Enter" && abierto && !value && lista.length > 0 && q !== "") {
            e.preventDefault();
            elegir(lista[0]);
          }
        }}
      />
      {abierto && !disabled && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 2,
            zIndex: 30,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--surface, #fff)",
            color: "var(--text, #1a1a1a)",
            border: "1px solid var(--border, #e4e4e7)",
            borderRadius: 8,
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        >
          {q === "" && lista.length > 0 && (
            <div
              style={{
                padding: "0.45rem 0.8rem 0.3rem",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--muted, #6b7280)",
              }}
            >
              Sugeridos · escribe para ver más
            </div>
          )}
          {lista.length === 0 && (
            <div style={{ padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "var(--muted, #6b7280)" }}>
              {q === "" ? mensajeVacio : "Sin resultados"}
            </div>
          )}
          {lista.map((p) => (
            <div
              key={p.id_producto}
              role="option"
              aria-selected={String(p.id_producto) === value}
              // mousedown (no click) para que corra antes del blur del input.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              style={{
                padding: "0.7rem 0.8rem", // objetivo táctil cómodo en tablet
                cursor: "pointer",
                fontSize: "0.9rem",
                borderTop: "1px solid var(--border, #e4e4e7)",
              }}
            >
              {p.nombre_producto}{" "}
              <span style={{ color: "var(--muted, #6b7280)", fontSize: "0.78rem" }}>
                {detalle ? detalle(p) : `(${p.codigo_producto})`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
