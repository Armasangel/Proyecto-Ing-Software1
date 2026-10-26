"use client";

import Link from "next/link";
import { useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { Icon, type IconName } from "@/components/Icon";
import { useDuenoSession } from "@/hooks/useDuenoSession";
import { FormularioCliente } from "@/components/crear/FormularioCliente";
import { FormularioProducto } from "@/components/crear/FormularioProducto";
import { FormularioPresentacion } from "@/components/crear/FormularioPresentacion";
import { FormularioCatalogoSimple } from "@/components/crear/FormularioCatalogoSimple";
import { FormularioProveedor } from "@/components/crear/FormularioProveedor";
import { FormularioBodega } from "@/components/crear/FormularioBodega";
import { FormularioUsuario } from "@/components/crear/FormularioUsuario";
import { FormularioDescuento } from "@/components/crear/FormularioDescuento";

const SECCIONES = [
  {
    id: "cliente",
    label: "Cliente",
    icon: "owner",
    descripcion: "Datos de contacto, facturación, crédito y tipo de cliente.",
    href: "/ventas",
    Formulario: FormularioCliente,
  },
  {
    id: "producto",
    label: "Producto",
    icon: "catalogue",
    descripcion: "Catálogo maestro con precios, proveedores y presentaciones.",
    href: "/inventario",
    Formulario: FormularioProducto,
  },
  {
    id: "presentacion",
    label: "Presentación",
    icon: "box",
    descripcion: "Empaques por mayor para un producto existente.",
    href: "/inventario",
    Formulario: FormularioPresentacion,
  },
  {
    id: "categoria",
    label: "Categoría",
    icon: "distribution",
    descripcion: "Agrupa los productos del catálogo.",
    href: "/inventario",
    Formulario: () => <FormularioCatalogoSimple tipo="categoria" />,
  },
  {
    id: "marca",
    label: "Marca",
    icon: "ticket",
    descripcion: "Fabricante o marca comercial de los productos.",
    href: "/inventario",
    Formulario: () => <FormularioCatalogoSimple tipo="marca" />,
  },
  {
    id: "proveedor",
    label: "Proveedor",
    icon: "hand-truck",
    descripcion: "Datos de contacto y NIT del proveedor.",
    href: "/proveedores",
    Formulario: FormularioProveedor,
  },
  {
    id: "bodega",
    label: "Bodega",
    icon: "inventory",
    descripcion: "Ubicaciones físicas donde se guarda el inventario.",
    href: "/inventario",
    Formulario: FormularioBodega,
  },
  {
    id: "usuario",
    label: "Usuario",
    icon: "seller",
    descripcion: "Colaboradores de tienda y bodegueros.",
    href: "/usuarios",
    Formulario: FormularioUsuario,
  },
  {
    id: "descuento",
    label: "Descuento",
    icon: "setting",
    descripcion: "Reglas por volumen con una asignación inicial opcional.",
    href: "/descuentos",
    Formulario: FormularioDescuento,
  },
] as const;

type SeccionId = (typeof SECCIONES)[number]["id"];

export default function CrearRegistrosPage() {
  const usuario = useDuenoSession();
  const [seccionId, setSeccionId] = useState<SeccionId>("cliente");

  if (!usuario) {
    return <p className="p-8 text-ink-muted">Cargando.</p>;
  }

  const seccion = SECCIONES.find((s) => s.id === seccionId) ?? SECCIONES[0];
  const Formulario = seccion.Formulario;

  return (
    <StaffShell
      usuario={usuario}
      title="Crear registros"
      subtitle="Da de alta clientes, productos, bodegas, proveedores y más desde un solo lugar"
    >
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Tipos de registro">
        {SECCIONES.map((s) => {
          const activa = s.id === seccion.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls={`panel-${s.id}`}
              onClick={() => setSeccionId(s.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-control border text-[0.85rem] font-semibold transition-colors ${
                activa
                  ? "bg-market text-white border-market shadow-warm"
                  : "bg-white text-ink-muted border-[var(--border)] hover:bg-cream-100"
              }`}
            >
              <Icon name={s.icon as IconName} size={16} />
              {s.label}
            </button>
          );
        })}
      </div>

      <section
        id={`panel-${seccion.id}`}
        role="tabpanel"
        aria-label={seccion.label}
        className="max-w-[820px] rounded-card border border-[var(--border)] bg-white p-6 shadow-warm"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-head text-[1.15rem] font-bold text-ink">Crear {seccion.label.toLowerCase()}</h2>
            <p className="mt-1 text-[0.85rem] text-ink-muted">{seccion.descripcion}</p>
          </div>
          <Link
            href={seccion.href}
            className="shrink-0 text-[0.82rem] font-semibold text-market-600 hover:underline"
          >
            Abrir sección
          </Link>
        </div>
        <Formulario />
      </section>
    </StaffShell>
  );
}
