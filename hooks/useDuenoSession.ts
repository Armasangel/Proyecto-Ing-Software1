"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffUsuario } from "@/components/StaffShell";
import { isDuenoTipo, postLoginPath } from "@/lib/roles";

/** Sesión restringida a dueño; redirige al resto a su vista. */
export function useDuenoSession(): StaffUsuario | null {
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
        if (!isDuenoTipo(d.usuario.tipo_usuario)) {
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
