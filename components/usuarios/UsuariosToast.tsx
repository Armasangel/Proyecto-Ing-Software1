import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuariosToast({ u }: { u: UsuariosController }) {
  if (!u.toast) return null;

  return (
    <div
      style={{
        ...s.toast,
        background:
          u.toast.tipo === "ok"
            ? "rgba(63,185,80,.15)"
            : "rgba(248,81,73,.15)",
        borderColor:
          u.toast.tipo === "ok"
            ? "rgba(63,185,80,.4)"
            : "rgba(248,81,73,.4)",
        color: u.toast.tipo === "ok" ? "var(--green)" : "var(--red)",
      }}
    >
      {u.toast.msg}
    </div>
  );
}
