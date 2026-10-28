"use client";

import { FC, ReactNode } from "react";
import type { DataTableColumn } from "@/components/list/DataTable";
import { StaffShell } from "@/components/StaffShell";
import { usePagination } from "@/lib/usePagination";
import { PaginationBar } from "@/components/pagination/PaginationBar";
import { DataTable } from "@/components/list/DataTable";

type StaffUser = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

type ListContainerProps = {
  title: string;
  subtitle: string;
  columns: DataTableColumn[];
  rows: { key: string }[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  noun: string;
  loading?: boolean;
  emptyMessage?: ReactNode;
};

export const ListContainer: FC<ListContainerProps> = ({
  title,
  subtitle,
  columns,
  rows,
  meta,
  onPageChange,
  onPerPageChange,
  noun,
  loading = false,
  emptyMessage,
}) => {
  const { page, perPage, totalPages, hasMore, nextPage, prevPage } =
    usePagination({
      meta,
      initialPage: meta.page,
      initialPerPage: meta.limit,
      onPageChange,
      onPerPageChange,
    });

  // Usuario tipo "DUENO" genérico para el StaffShell.
  // Cada página proveerá el usuario real a través de su propio estado.
  const staffUser: StaffUser = {
    id_usuario: 1,
    nombre: "Dueño",
    correo: "dueño@tienda.com",
    tipo_usuario: "DUENO",
  };

  return (
    <StaffShell usuario={staffUser} title={title} subtitle={subtitle}>
      <div className="min-h-0 flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row items-center gap-4">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="text-ink-muted text-sm">{subtitle}</p>
        </header>

        <main className="flex-1">
          {loading ? (
            <p className="p-4 text-ink-muted text-[0.9rem]">Cargando…</p>
          ) : rows.length === 0 ? (
            <>{emptyMessage}</>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              loading={loading}
              empty={emptyMessage}
            />
          )}
        </main>
      </div>

      <footer className="mt-6">
        <PaginationBar
          total={meta.total}
          page={page}
          perPage={perPage}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          noun={noun}
          variant="default"
        />
      </footer>
    </StaffShell>
  );
};