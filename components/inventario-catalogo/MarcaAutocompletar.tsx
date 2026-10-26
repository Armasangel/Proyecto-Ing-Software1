import { useMemo } from "react";
import type { ComponentProps } from "react";
import { CatalogoAutocompletar } from "@/components/inventario-catalogo/CatalogoAutocompletar";

type Marca = { id_marca: number; nombre_marca: string; usos?: number };
type Props = Pick<ComponentProps<typeof CatalogoAutocompletar>, "value" | "onChange" | "style" | "disabled" | "opcional"> & {
  marcas: Marca[];
  ariaLabel?: string;
  textoSinSeleccion?: string;
};

export function MarcaAutocompletar({ marcas, ariaLabel = "Marca", textoSinSeleccion = "Sin marca", ...props }: Props) {
  const opciones = useMemo(() => [...marcas]
    .sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0) || a.nombre_marca.localeCompare(b.nombre_marca) || a.id_marca - b.id_marca)
    .map((m) => ({ id: m.id_marca, nombre: m.nombre_marca })), [marcas]);
  return <CatalogoAutocompletar {...props} opciones={opciones} ariaLabel={ariaLabel} aleatorias={false}
    placeholder={props.opcional ? textoSinSeleccion : "Busca una marca…"} textoSinSeleccion={textoSinSeleccion}
    etiquetaSugerencias="Más usadas · escribe para ver más" mensajeVacio="Sin resultados. Puedes crear una marca." />;
}
