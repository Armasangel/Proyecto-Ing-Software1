"use client";

/* Shell principal para dueño y colaborador.
   Incluye sidebar fijo, topbar con título y slot de contenido. */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isColaboradorTipo, isDuenoTipo, labelRol, staffVariantFromTipo } from "@/lib/roles";
import { Icon, type IconName } from "@/components/Icon";
import { VentaToastListener } from "@/components/VentaToastListener";

export type StaffUsuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

/* Mapa de rutas a iconos */
const NAV: NavItem[] = [
  { href: "/dashboard",        label: "Dashboard",       icon: "dashboard"     },
  { href: "/inventario",       label: "Inventario",      icon: "inventory"     },
  { href: "/catalogo",         label: "Catálogo",        icon: "catalogue"     },
  { href: "/ventas",           label: "Ventas",          icon: "shopping-cart" },
  { href: "/facturacion",      label: "Facturación",     icon: "bill"          },
  { href: "/reportes",         label: "Reportes",        icon: "report"        },
  { href: "/proveedores",      label: "Proveedores",     icon: "hand-truck"    },
  { href: "/historial-ventas", label: "Historial ventas",icon: "distribution"  },
  { href: "/deudas",           label: "Deudas",          icon: "debt"     },
];

function isStaffNavActive(
  pathname: string,
  href: string,
  allHrefs: readonly string[]
): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
}

/* Cada rol tiene un acento propio para diferenciarse a simple vista,
   ambos anclados a la paleta cálida (nada de azules ajenos a la marca). */
const THEMES = {
  dueno: {
    rolLabel: "Panel del dueño",
    rolIcon: "owner" as IconName,
    rolTextClass: "text-mango-100",
    avatarClass: "bg-mango text-ink",
    pageAccentClass: "text-mango-600",
  },
  colaborador: {
    rolLabel: "Colaborador",
    rolIcon: "seller" as IconName,
    rolTextClass: "text-market-100",
    avatarClass: "bg-market text-white",
    pageAccentClass: "text-market-600",
  },
} as const;

type Props = {
  usuario: StaffUsuario;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function StaffShell({ usuario, title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const variant = staffVariantFromTipo(usuario.tipo_usuario);
  const t = THEMES[variant];

  const navVisible = NAV.filter((item) => {
    if (item.href === "/ventas") return isColaboradorTipo(usuario.tipo_usuario);
    if (["/inventario", "/catalogo", "/historial-ventas", "/proveedores", "/deudas"].includes(item.href)) {
      return isDuenoTipo(usuario.tipo_usuario);
    }
    return true;
  });

  const navHrefs = navVisible.map((n) => n.href);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen font-body bg-cream">
      <aside className="w-[230px] shrink-0 bg-sidebar flex flex-col justify-between sticky top-0 h-screen shadow-warm-lg">
        <div className="px-4 pt-6 pb-4">
          {/* Logo */}
          <Link href="/dashboard" className="no-underline">
            <div className="flex items-center gap-2.5 mb-5 p-2 rounded-control bg-market/10 border border-market/15">
              <div>
                <div className="font-head font-extrabold text-base text-cream leading-tight">Tienda</div>
                <div className="font-head font-semibold text-[0.72rem] text-market-100 tracking-wider uppercase">
                  San Miguel
                </div>
              </div>
            </div>
          </Link>

          {/* Rol */}
          <div className={`flex items-center gap-1.5 text-[0.72rem] font-bold mb-5 pl-1 opacity-90 ${t.rolTextClass}`}>
            <Icon name={t.rolIcon} size={14} variant="light" />
            {t.rolLabel}
          </div>

          {/* Navegación */}
          <nav className="flex flex-col gap-0.5">
            {navVisible.map((item) => {
              const active = isStaffNavActive(pathname, item.href, navHrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-control text-[0.85rem] no-underline transition-colors duration-150 ${
                    active
                      ? "bg-sidebar-active text-cream font-semibold"
                      : "text-sidebar-muted font-normal hover:bg-sidebar-hover"
                  }`}
                >
                  <Icon name={item.icon} size={18} variant="light" />
                  <span className={active ? "opacity-100" : "opacity-75"}>{item.label}</span>
                  {active && <span className="w-[5px] h-[5px] rounded-full bg-market ml-auto shrink-0" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Usuario y logout */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 mb-3 p-2 rounded-control bg-white/[0.04]">
            <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center font-head text-sm font-bold shrink-0 ${t.avatarClass}`}>
              {usuario.nombre[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[0.85rem] font-semibold text-cream truncate">
                {usuario.nombre.split(" ")[0]}
              </div>
              <div className={`text-[0.7rem] mt-0.5 ${t.rolTextClass}`}>{labelRol(usuario.tipo_usuario)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 bg-transparent border border-sidebar-border rounded-control text-sidebar-muted px-3 py-2 text-[0.82rem] text-left transition-colors duration-150 hover:bg-white/5 hover:text-cream"
          >
            <Icon name="logout" size={14} variant="light" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-8 overflow-y-auto bg-cream">
        <div className="mb-8">
          <h1 className={`font-head text-[1.7rem] font-extrabold mb-1 ${t.pageAccentClass}`}>{title}</h1>
          {subtitle && <p className="text-ink-muted text-[0.88rem]">{subtitle}</p>}
        </div>
        {children}
      </main>

      {/* Toast de venta realizada — solo el dueño lo ve, para enterarse en
          tiempo casi-real cuando un empleado registra una venta. */}
      {variant === "dueno" && <VentaToastListener />}
    </div>
  );
}
