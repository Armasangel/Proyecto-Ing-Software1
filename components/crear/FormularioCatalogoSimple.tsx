"use client";

import { useState } from "react";
import { Campo, Mensaje, enviarJson, inputCls, primaryBtnCls } from "@/components/crear/ui";

type TipoCatalogo = "categoria" | "marca";

const CONFIG: Record<
  TipoCatalogo,
  { campo: "nombre_categoria" | "nombre_marca"; endpoint: string; etiqueta: string; placeholder: string }
> = {
  categoria: {
    campo: "nombre_categoria",
    endpoint: "/api/categorias",
    etiqueta: "categoría",
    placeholder: "Lácteos",
  },
  marca: {
    campo: "nombre_marca",
    endpoint: "/api/marcas",
    etiqueta: "marca",
    placeholder: "Marca propia",
  },
};

export function FormularioCatalogoSimple({ tipo }: { tipo: TipoCatalogo }) {
  const config = CONFIG[tipo];
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!nombre.trim()) {
      setError(`El nombre de la ${config.etiqueta} es obligatorio`);
      return;
    }
    setGuardando(true);
    try {
      const { ok: exito, data } = await enviarJson(config.endpoint, {
        [config.campo]: nombre.trim(),
      });
      if (!exito) {
        setError(String(data.error || `No se pudo crear la ${config.etiqueta}`));
        return;
      }
      setOk(`Se creó la ${config.etiqueta} «${nombre.trim()}».`);
      setNombre("");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4">
      <Campo label={`Nombre de la ${config.etiqueta}`} required>
        <input
          className={inputCls}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={config.placeholder}
        />
      </Campo>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando}>
          {guardando ? "Creando…" : `Crear ${config.etiqueta}`}
        </button>
      </div>
    </form>
  );
}
