"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isBodegueroTipo, postLoginPath } from "@/lib/roles";

export type BodegueroUsuario = {
  id_usuario: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
  id_bodega: number;
};

/** Sesión restringida a bodeguero; redirige al resto a su vista. */
export function useBodegueroSession(): BodegueroUsuario | null {
  const router = useRouter();
  const [usuario, setUsuario] = useState<BodegueroUsuario | null>(null);

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
        if (!isBodegueroTipo(d.usuario.tipo_usuario) || !d.usuario.id_bodega) {
          router.replace(postLoginPath(d.usuario.tipo_usuario));
          return;
        }
        setUsuario(d.usuario as BodegueroUsuario);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return usuario;
}
