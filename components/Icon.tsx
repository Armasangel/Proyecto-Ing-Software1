/* Componente de iconos del sistema.
   variant="dark"  → iconos negros, para fondos claros (default)
   variant="light" → iconos blancos/crema, para fondos oscuros (sidebar)
   Los archivos viven en /public/icons/{variant}/{name}.png */

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
  | "money-bag";

type Props = {
  name: IconName;
  size?: number;
  variant?: "dark" | "light";
  className?: string;
};

export function Icon({ name, size = 20, variant = "dark", className }: Props) {
  return (
    <img
      src={`/icons/${variant}/${name}.png`}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ display: "block", flexShrink: 0 }}
      className={className}
    />
  );
}