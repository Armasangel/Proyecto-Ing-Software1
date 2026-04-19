"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffUsuario } from "@/components/StaffShell";
import { isStaffTipo, postLoginPath } from "@/lib/roles";

/** Sesión restringida a dueño / colaborador; redirige al resto a su vista. */
export function useStaffSession(): StaffUsuario | null {
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
        if (!isStaffTipo(d.usuario.tipo_usuario)) {
          router.replace(postLoginPath(d.usuario.tipo_usuario));
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
