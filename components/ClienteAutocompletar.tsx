"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { muestraAleatoria, normalizarTexto } from "@/components/ProductoAutocompletar";

/**
 * Selector de cliente con sugerencias, para reemplazar los typeaheads que
 * estaban duplicados en Ventas y en Cuentas por Cobrar:
 *   - sin escribir nada muestra 5 clientes al azar (se vuelven a sortear cada
 *     vez que se abre el campo);
 *   - al escribir busca en TODO el catálogo por CÓDIGO, nombre, NIT, teléfono
 *     o correo (sin importar mayúsculas ni acentos) y muestra hasta 8
 *     coincidencias.
 *
 * Cuando se elige un cliente se entrega `onSelect` con el cliente completo,
 * para que la pantalla pueda rellenar sus datos (NIT, dirección de entrega,
 * tipo de venta, etc.).
 */

export type ClienteOpcion = {
  id_cliente: number;
  nombre: string;
  codigo_cliente?: string | null;
  nit_cliente?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  es_consumidor_final?: boolean;
};

export const SUGERIDOS_CLIENTE = 5;
const MAX_RESULTADOS = 8;

type Props<T extends ClienteOpcion> = {
  /** Catálogo completo donde se busca al escribir. */
  clientes: T[];
  /** Si se pasa, se muestran estos en vez de una muestra al azar del catálogo. */
  sugeridos?: T[];
  /** id_cliente del cliente elegido como string ("" = ninguno). */
  value: string;
  onChange: (idCliente: string) => void;
  /** Se dispara al elegir un cliente, con sus datos completos. */
  onSelect?: (cliente: T) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  /** Estilo del contenedor (p. ej. `flex: 1` dentro de una fila). */
  wrapperStyle?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
  /** Mensaje cuando no hay nada que sugerir con el campo vacío. */
  mensajeVacio?: string;
  /** Encabezado de la lista de sugerencias (por defecto "Sugeridos"). */
  tituloSugeridos?: string;
  /** Dato extra de cada opción (ej. "3 ventas"). */
  detalle?: (cliente: T) => string | null;
};

/** "Pedro Díaz (CLI-00012)" — el código va siempre, aunque sea null (cliente viejo). */
export function etiquetaClienteConCodigo(c: ClienteOpcion): string {
  return c.codigo_cliente ? `${c.nombre} (${c.codigo_cliente})` : c.nombre;
}

/** ¿Este cliente coincide con lo que el usuario está escribiendo? */
export function clienteCoincide(c: ClienteOpcion, consulta: string): boolean {
  const q = normalizarTexto(consulta.trim());
  if (!q) return false;
  return (
    normalizarTexto(c.nombre).includes(q) ||
    normalizarTexto(c.codigo_cliente ?? "").includes(q) ||
    normalizarTexto(c.nit_cliente ?? "").includes(q) ||
    normalizarTexto(c.telefono ?? "").includes(q) ||
    normalizarTexto(c.correo ?? "").includes(q)
  );
}

export function ClienteAutocompletar<T extends ClienteOpcion>({
  clientes,
  sugeridos,
  value,
  onChange,
  onSelect,
  placeholder = "Busca por código, nombre, NIT o teléfono…",
  className,
  style,
  wrapperStyle,
  disabled,
  ariaLabel = "Cliente",
  mensajeVacio = "Escribe para buscar un cliente",
  tituloSugeridos = "Sugeridos · escribe para ver más",
  detalle,
}: Props<T>) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [muestra, setMuestra] = useState<T[]>([]);

  // Último valor que emitimos nosotros: sirve para distinguir un cambio de
  // `value` hecho desde afuera (limpiar el formulario, precargar) de uno que
  // viene de lo que el usuario acaba de escribir.
  const ultimoEmitido = useRef(value);
  const clientesRef = useRef(clientes);
  clientesRef.current = clientes;

  // Cliente elegido actualmente. La fuente de verdad es el `value` que manda la
  // pantalla: el texto visible se DERIVA de aquí, así el campo nunca queda
  // desincronizado con la selección (por ejemplo, al crear un cliente y
  // seleccionarlo de inmediato).
  const clienteActual = value
    ? clientes.find((c) => String(c.id_cliente) === value) ?? null
    : null;

  const resortear = useCallback(() => {
    setMuestra(muestraAleatoria(clientesRef.current, SUGERIDOS_CLIENTE));
  }, []);

  // Se sortea de nuevo cuando llega (o cambia de tamaño) el catálogo.
  useEffect(() => {
    resortear();
  }, [clientes.length, resortear]);

  // Si la pantalla cambia la selección por su cuenta (limpiar el formulario,
  // preseleccionar, crear y elegir un cliente), se descarta el texto anterior:
  // el que se muestra es el del cliente elegido.
  useEffect(() => {
    if (value === ultimoEmitido.current) return;
    ultimoEmitido.current = value;
    setTexto("");
  }, [value]);

  const emitir = (id: string) => {
    ultimoEmitido.current = id;
    onChange(id);
  };

  // Lo que el usuario ve: el cliente elegido (con su código) o, si no hay
  // ninguno, lo que está escribiendo.
  const textoMostrado = clienteActual ? etiquetaClienteConCodigo(clienteActual) : texto;
  const q = texto.trim();
  const coincidencias = q === "" ? [] : clientes.filter((c) => clienteCoincide(c, q)).slice(0, MAX_RESULTADOS);
  const lista = q === "" ? (sugeridos ?? muestra).slice(0, SUGERIDOS_CLIENTE) : coincidencias;

  const elegir = (c: T) => {
    emitir(String(c.id_cliente));
    setTexto(etiquetaClienteConCodigo(c));
    setAbierto(false);
    onSelect?.(c);
  };

  // Datos de la opción: NIT, teléfono y el extra que pase la pantalla.
  const detalleLinea = (c: T) =>
    [
      c.nit_cliente ? `NIT ${c.nit_cliente}` : "",
      c.telefono ? `Tel ${c.telefono}` : "",
      detalle?.(c) ?? "",
    ]
      .filter(Boolean)
      .join(" · ");

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
        value={textoMostrado}
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
          // Si escribió algo que solo coincide con un cliente, se da por
          // elegido (así no queda un texto "huérfano" sin cliente asignado).
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
              {tituloSugeridos}
            </div>
          )}
          {lista.length === 0 && (
            <div style={{ padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "var(--muted, #6b7280)" }}>
              {q === "" ? mensajeVacio : "Sin resultados"}
            </div>
          )}
          {lista.map((c) => (
            <div
              key={c.id_cliente}
              role="option"
              aria-selected={String(c.id_cliente) === value}
              // mousedown (no click) para que corra antes del blur del input.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(c);
              }}
              style={{
                padding: "0.55rem 0.8rem", // objetivo táctil cómodo en tablet
                cursor: "pointer",
                fontSize: "0.9rem",
                borderTop: "1px solid var(--border, #e4e4e7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 500 }}>{c.nombre}</span>
                {c.codigo_cliente && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      padding: "0.05rem 0.4rem",
                      borderRadius: 5,
                      border: "1px solid var(--border, #e4e4e7)",
                      color: "var(--muted, #6b7280)",
                    }}
                  >
                    {c.codigo_cliente}
                  </span>
                )}
                {c.es_consumidor_final && (
                  <span
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "0.05rem 0.4rem",
                      borderRadius: 5,
                      background: "rgba(29,36,202,0.08)",
                      color: "#1D24CA",
                    }}
                  >
                    Consumidor Final
                  </span>
                )}
              </div>
              {detalleLinea(c) && (
                <div style={{ fontSize: "0.76rem", color: "var(--muted, #6b7280)", marginTop: "0.1rem" }}>
                  {detalleLinea(c)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
