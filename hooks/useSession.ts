"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffUsuario } from "@/components/StaffShell";
import { postLoginPath, TIPOS_USUARIO, type TipoUsuarioDb } from "@/lib/roles";

/** Usuario de bodega: además de los datos comunes trae su bodega asignada. */
export type BodegueroUsuario = StaffUsuario & { id_bodega: number };

/**
 * Tipo de usuario que devuelve el hook según los roles pedidos:
 * si incluye BODEGUERO trae `id_bodega`; con DUENO/EMPLEADO es `StaffUsuario`.
 */
export type UsuarioPorRol<R extends TipoUsuarioDb> = R extends typeof TIPOS_USUARIO.BODEGUERO
  ? BodegueroUsuario
  : StaffUsuario;

/**
 * Sesión restringida a los `roles` indicados. Reemplaza a `useStaffSession`,
 * `useDuenoSession` y `useBodegueroSession`.
 *
 *   const usuario = useSession({ roles: ROLES_STAFF });      // dueño o colaborador
 *   const usuario = useSession({ roles: ROLES_DUENO });      // solo dueño
 *   const usuario = useSession({ roles: ROLES_BODEGUERO });  // bodeguero (trae id_bodega)
 *
 * Lee el usuario de `/api/sesion` y:
 *  - sin sesión → redirige a `/login`;
 *  - con un rol no permitido (o bodeguero sin bodega asignada) → redirige a la
 *    vista que le corresponde (`postLoginPath`);
 *  - si todo está bien devuelve el usuario. Mientras tanto devuelve `null`.
 */
export function useSession<const R extends readonly TipoUsuarioDb[]>({
  roles,
}: {
  roles: R;
}): UsuarioPorRol<R[number]> | null {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioPorRol<R[number]> | null>(null);

  // Clave estable: quien llama puede pasar un array nuevo en cada render
  // (`{ roles: ["DUENO"] }`) sin que el efecto vuelva a pedir la sesión.
  const rolesKey = roles.join(",");

  useEffect(() => {
    const permitidos = rolesKey.split(",");
    let cancelled = false;
    fetch("/api/sesion")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.usuario) {
          router.replace("/login");
          return;
        }
        const tipo: string = d.usuario.tipo_usuario;
        const rolPermitido = permitidos.includes(tipo);
        const bodegaValida = tipo !== TIPOS_USUARIO.BODEGUERO || Boolean(d.usuario.id_bodega);
        if (!rolPermitido || !bodegaValida) {
          router.replace(postLoginPath(tipo));
          return;
        }
        setUsuario(d.usuario as UsuarioPorRol<R[number]>);
      });
    return () => {
      cancelled = true;
    };
  }, [router, rolesKey]);

  return usuario;
}
