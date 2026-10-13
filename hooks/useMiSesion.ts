"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffUsuario } from "@/components/StaffShell";

/**
 * Sesión de cualquier rol (incluido BODEGUERO), para las páginas que no
 * dependen del tipo de usuario. `useStaffSession` no sirve aquí porque manda
 * al bodeguero a /bodega.
 */
export function useMiSesion(): StaffUsuario | null {
  const router = useRouter();
  const [usuario, setUsuario] = useState<StaffUsuario | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sesion")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.usuario) {
          router.replace("/login");
          return;
        }
        setUsuario(d.usuario);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return usuario;
}