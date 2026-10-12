export type PeriodoKey = "day" | "week" | "month" | "quarter" | "year" | "custom";

export type EstadisticasData = {
  periodo: { tipo: string; desde: string | null; hasta: string | null };
  resumen: {
    total_ventas: number;
    ingresos_totales: number;
    ticket_promedio: number;
    ventas_canceladas: number;
  };
  estadisticas_descriptivas: {
    media: number;
    mediana: number;
    moda: number[];
    desviacion_estandar: number;
    min_total: number;
    max_total: number;
    n: number;
  };
  ventas_por_dia: { fecha: string; total_dia: number; cantidad: number }[];
  ventas_por_tipo: { tipo_venta: string; cantidad: number; ingresos: number }[];
  ventas_por_estado: { estado_venta: string; cantidad: number }[];
  top_productos: {
    id_producto: number;
    codigo_producto: string;
    nombre_producto: string;
    unidad_medida: string;
    nombre_categoria: string;
    nombre_marca: string;
    total_unidades: number;
    total_ingresos: number;
    veces_vendido: number;
  }[];
  producto_mas_comprado: {
    id_producto: number;
    codigo_producto: string;
    nombre_producto: string;
    unidad_medida: string;
    nombre_categoria: string;
    nombre_marca: string;
    total_unidades: number;
    total_ingresos: number;
    veces_vendido: number;
  } | null;
  top_clientes: {
    id_cliente: number;
    nombre: string;
    correo: string;
    tipo_usuario: string;
    total_compras: number;
    cantidad_pedidos: number;
  }[];
  ingresos_por_categoria: {
    nombre_categoria: string;
    total_ingresos: number;
    total_unidades: number;
  }[];
  ventas_por_hora: { hora: number; cantidad: number }[];
  comparativa_periodo_anterior: {
    total_ventas_anterior: number;
    ingresos_anteriores: number;
  } | null;
  top_bodegas: {
    id_bodega: number;
    nombre_bodega: string;
    total_movimientos: number;
    total_unidades: number;
  }[];
  deudas: {
    resumen: {
      deuda_pendiente_total: number;
      cantidad_deudores: number;
      cantidad_deudas_pendientes: number;
      clientes_bloqueados: number;
      deuda_promedio_por_deudor: number;
    };
    top_deudores: {
      id_cliente: number | null;
      nombre: string;
      telefono: string | null;
      limite_deuda: number | null;
      puede_comprar: boolean | null;
      deuda_pendiente: number;
      cantidad_deudas: number;
    }[];
  };
  kpis: {
    ventas: {
      ticket_promedio: number;
      ventas_credito: number;
      monto_credito: number;
      pct_ventas_credito: number;
    };
    inventario: {
      productos_bajo_minimo: number;
      detalle_bajo_minimo: {
        id_producto: number;
        nombre_producto: string;
        nombre_bodega: string;
        cantidad_disponible: number;
        stock_minimo: number;
      }[];
      rotacion_inventario: number;
      productos_sin_movimiento: number;
      detalle_sin_movimiento: {
        id_producto: number;
        nombre_producto: string;
        nombre_bodega: string;
        cantidad_disponible: number;
        valor_inmovilizado: number;
      }[];
    };
    deuda: {
      pct_cartera_vencida: number;
      tasa_recuperacion: number;
      deuda_pendiente_bloqueados: number;
    };
    operacion: {
      ventas_pendientes: number;
      monto_ventas_pendientes: number;
      pct_cancelacion: number;
      pedidos_pendientes: number;
      monto_pedidos_pendientes: number;
    };
  };
};
