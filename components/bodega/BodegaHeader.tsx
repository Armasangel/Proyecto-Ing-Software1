"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { s } from "@/lib/styles/bodega";
import type { useBodega } from "@/hooks/useBodega";

export function BodegaHeader({ h }: { h: ReturnType<typeof useBodega> }) {
  return (
    <header style={s.header}>
      <div>
        <div style={s.title}>
          <Icon name="hand-truck" size={22} /> Panel de bodega
        </div>
        <div style={s.subtitle}>{h.usuario?.nombre}</div>
      </div>
      <div style={s.headerAcciones}>
        <Link href="/mi-cuenta" style={{ ...s.logoutBtn, textDecoration: "none" }}>
          <Icon name="lockout" size={14} variant="light" /> Mi cuenta
        </Link>
        <button type="button" style={s.logoutBtn} onClick={h.handleLogout}>
          <Icon name="logout" size={14} variant="light" /> Cerrar sesión
        </button>
      </div>
    </header>
  );
}
