"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deudoresFiltersToSearchParams,
  type DeudoresFilters,
} from "@/lib/cobranza/deudores-query";
import type {
  DeudoresResumenResponse,
  DeudoresResponse,
} from "@/components/cobranza/types";

async function fetchDeudores(filters: DeudoresFilters): Promise<DeudoresResponse> {
  const sp = deudoresFiltersToSearchParams(filters);
  const res = await fetch(`/api/deudores?${sp.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al cargar deudas");
  return data;
}

async function fetchDeudoresResumen(): Promise<DeudoresResumenResponse> {
  const res = await fetch("/api/deudores/resumen");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al cargar resumen");
  return data;
}

export function useDeudores(filters: DeudoresFilters, enabled = true) {
  return useQuery({
    queryKey: ["deudores", filters],
    queryFn: () => fetchDeudores(filters),
    enabled,
  });
}

export function useDeudoresResumen(enabled = true) {
  return useQuery({
    queryKey: ["deudores-resumen"],
    queryFn: fetchDeudoresResumen,
    enabled,
  });
}

export function useInvalidateCobranza() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["deudores"] });
    qc.invalidateQueries({ queryKey: ["deudores-resumen"] });
  };
}
