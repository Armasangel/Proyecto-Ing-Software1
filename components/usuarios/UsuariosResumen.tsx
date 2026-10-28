import { TIPOS_USUARIO } from "@/lib/roles";
import { TIPO_META } from "@/lib/constants/usuarios";
import { s } from "@/lib/styles/usuarios";
import type { UsuariosController } from "@/hooks/useUsuarios";

export function UsuariosResumen({ u }: { u: UsuariosController }) {
  return (
    <div style={s.statsGrid}>
      {u.totalPorTipo.map((t) => {
        const meta = TIPO_META[t.value];
        return (
          <div key={t.value} style={s.statCard}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: meta.color,
                marginBottom: "0.5rem",
              }}
            />
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: meta.color, fontFamily: "var(--font-head)" }}>
              {t.count}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{t.label}</div>
            <div
              style={{
                fontSize: "0.72rem",
                marginTop: "0.5rem",
                color: u.cupoLleno(t.value) ? "var(--red, #f85149)" : "var(--muted)",
                fontWeight: u.cupoLleno(t.value) ? 700 : 400,
              }}
            >
              Activos: {u.cupos[t.value]?.activos ?? "…"} · {u.textoLimite(t.value)}
              {u.cupoLleno(t.value) ? " (lleno)" : ""}
            </div>
            {t.value === TIPOS_USUARIO.DUENO && (u.cupoDuenoActual || u.cuposDueno) && (
              <div data-testid="cupos-dueno">{u.cuposResumen}</div>
            )}
            <button
              type="button"
              onClick={() => u.abrirLimite(t.value)}
              disabled={!u.cupos[t.value]}
              style={{ ...s.btnLimite, color: meta.color }}
              title="Cambiar el límite (pide verificación por correo)"
            >
              Cambiar límite
            </button>
          </div>
        );
      })}
    </div>
  );
}
