/* Componente de iconos del sistema.
   Los SVGs viven en /components/icons/ y se renderizan como inline SVG.
   El color se controla dinámicamente con fill="currentColor" (heredado del color
   CSS del contenedor) o mediante la prop color. variant="light" se conserva por
   compatibilidad y fija un color claro por defecto para fondos oscuros (sidebar). */

import { iconMap } from "@/components/icons";

export type IconName =
  | "catalogue"
  | "dashboard"
  | "inventory"
  | "lockout"
  | "logout"
  | "hand-truck"
  | "shopping-cart"
  | "seller"
  | "owner"
  | "increase"
  | "distribution"
  | "report"
  | "bill"
  | "money-bag"
  | "debt"
  | "pencil"
  | "trash"
  | "box"
  | "transfer"
  | "setting"
  | "close"
  | "ticket";

type Props = {
  name: IconName;
  size?: number;
  variant?: "dark" | "light";
  color?: string;
  className?: string;
};

export function Icon({ name, size = 20, variant = "dark", color, className }: Props) {
  const SvgIcon = iconMap[name];

  if (!SvgIcon) {
    return null;
  }

  const resolvedColor = color ?? (variant === "light" ? "#faf8f2" : undefined);

  return <SvgIcon size={size} color={resolvedColor} className={className} />;
}
