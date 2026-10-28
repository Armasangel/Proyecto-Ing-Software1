"use client";

import { FC, ReactNode } from "react";

/** Configuración de una columna de tabla */
export type DataTableColumn = {
  /** Clave del dato en el objeto de la fila */
  key: string;
  /** Texto mostrado en el encabezado */
  header: string;
  /** Clases Tailwind opcionales para el encabezado (th) */
  thClassName?: string;
  /** Clases Tailwind opcionales para las celdas (td) */
  tdClassName?: string;
  /** Render personalizado del valor de la celda. Si se omite, se muestra el valor crudo. */
  render?: (row: Record<string, unknown>) => ReactNode;
};

/** Props del componente DataTable */
export type DataTableProps = {
  /** Filas de datos a mostrar */
  rows: { key: string }[];
  /** Columnas de la tabla */
  columns: DataTableColumn[];
  /** Estado de carga */
  loading?: boolean;
  /** Mesaje a mostrar cuando no hay filas */
  empty?: ReactNode;
  /** Clases Tailwind adicionales sobre el contenedor de la tabla */
  className?: string;
  /** Si verdadero, muestra un thead fijo (útil en tablas largas) */
  stickyHeader?: boolean;
};

/** Componente DataTable unificado.
 *
 * Renderiza un `<table>` Tailwind con encabezado, cuerpo y pies.
 * Los estilos siguen las convenciones del proyecto:
 *   --bg:cream, --text:ink, --border, rounded-control, shadow-warm.
 */
export const DataTable: FC<DataTableProps> = ({
  rows,
  columns,
  loading,
  empty: emptyProp,
  className: extraClass,
  stickyHeader = false,
}) => {
  if (loading) {
    return (
      <p className="p-4 text-ink-muted text-[0.9rem]">
        Cargando…
      </p>
    );
  }

  // Si no hay filas, mostrar estado vacío
  if (rows.length === 0) {
    const emptyMsg =
      emptyProp !== undefined
        ? emptyProp
        : <p className="p-6 text-center text-ink-muted">
            No hay registros con los filtros actuales.
          </p>;
    return <p className="p-6 text-center text-ink-muted">{emptyMsg}</p>;
  }

  // Extraer headers y body de las columnas
  const renderHeader = () => (
    <thead>
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            className={`
              bg-surface-soft text-ink-muted text-[0.72rem] font-semibold tracking-[0.06em] uppercase px-4 py-3 text-left border-b border-line
              ${col.thClassName || ""}
            `}
          >
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  const renderBody = () => (
    <tbody>
      {rows.map((row, i) => (
        <tr
          key={row.key ?? i}
          className={`bg-surface ${i % 2 === 0 ? "border-b" : "border-b border-line"} hover:bg-cream/50 transition-colors`}
        >
          {columns.map((col) => {
            const value = (row as Record<string, unknown>)[col.key];
            return (
              <td
                key={`${col.key}-${i}`}
                className={`
                  px-4 py-3 text-[0.88rem] align-top
                  border-b border-line ${col.tdClassName || ""}
                `}
              >
                {col.render ? (
                  col.render(row as Record<string, unknown>)
                ) : value !== null && value !== undefined ? (
                  <span>{String(value)}</span>
                ) : (
                  <span className="text-ink-muted opacity-60">—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );

  return (
    <table
      className={`
        w-full border-collapse ${extraClass || ""}
        ${stickyHeader && "sticky top-0 z-20 bg-cream"}
      `}
    >
      {renderHeader()}
      {renderBody()}
    </table>
  );
};

export default DataTable;