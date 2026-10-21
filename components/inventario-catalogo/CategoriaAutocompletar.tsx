import { useMemo } from "react";
import type { ComponentProps } from "react";
import { CatalogoAutocompletar } from "@/components/inventario-catalogo/CatalogoAutocompletar";

type Props = Pick<ComponentProps<typeof CatalogoAutocompletar>, "value" | "onChange" | "ariaLabel" | "opcional" | "disabled" | "style"> & {
  categorias: { id_categoria: number; nombre_categoria: string }[];
};

export function CategoriaAutocompletar({ categorias, ...props }: Props) {
  const opciones = useMemo(() => categorias.map((c) => ({ id: c.id_categoria, nombre: c.nombre_categoria })), [categorias]);
  return <CatalogoAutocompletar {...props} opciones={opciones}
    placeholder={props.opcional ? "Sin categoría" : "Busca una categoría…"}
    textoSinSeleccion="Sin categoría" mensajeVacio="Sin resultados. Puedes crear una categoría." />;
}
