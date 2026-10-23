import { EMPTY_FORM, TIPOS_OPCIONES } from "@/lib/constants/usuarios";
import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuariosToolbar({ u }: { u: UsuariosController }) {
  return (
    <div style={s.toolbar}>
      <input
        type="search"
        placeholder="Buscar por nombre o correo…"
        value={u.busqueda}
        onChange={(e) => u.setBusqueda(e.target.value)}
        style={s.searchInput}
      />
      <select
        value={u.filtroTipo}
        onChange={(e) => u.setFiltroTipo(e.target.value)}
        style={s.select}
      >
        {TIPOS_OPCIONES.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => u.cargar()} style={s.btnGhost} disabled={u.loading}>
        {u.loading ? "Actualizando…" : "Actualizar"}
      </button>
      <button
        type="button"
        onClick={() => {
          u.setNuevoForm({ ...EMPTY_FORM });
          u.setModalNuevo(true);
        }}
        style={s.btnPrimary}
      >
        + Nuevo usuario
      </button>
    </div>
  );
}
