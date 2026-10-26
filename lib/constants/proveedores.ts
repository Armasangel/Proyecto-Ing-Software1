import type { ProveedorForm } from "@/lib/types/proveedores";

export const FORM_VACIO_PROVEEDOR: ProveedorForm = {
  nombre_proveedor: "",
  nit_proveedor: "",
  correo_contacto: "",
  telefono: "",
};

export const INPUT_CLS_PROVEEDOR =
  "w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";

export const INPUT_CLS_PROVEEDOR_TOOLBAR =
  "px-3.5 py-2.5 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40";
