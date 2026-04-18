"use client";
// app/inventario/page.tsx
// RF3 — Vista de inventario diferenciada por rol
// RF2 — CRUD de productos (solo DUENO)
 
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
 
// ─── Tipos ────────────────────────────────────────────────────────────────────
 
interface Producto {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  nombre_categoria: string;
  id_categoria: number;
  nombre_marca: string;
  id_marca: number;
  precio_unitario: string | null;
  precio_mayoreo: string | null;
  unidad_medida: string;
  estado_producto: boolean;
  caducidad: boolean;
  exento_iva: boolean;
}
 
interface Categoria { id_categoria: number; nombre_categoria: string; }
interface Marca      { id_marca: number;     nombre_marca: string; }
interface Usuario    { id_usuario: number; nombre: string; correo: string; tipo_usuario: string; }
 
const EMPTY_FORM = {
  codigo_producto: "",
  nombre_producto: "",
  precio_unitario: "",
  precio_mayoreo: "",
  unidad_medida: "",
  id_categoria: "",
  id_marca: "",
  caducidad: false,
  exento_iva: false,
  estado_producto: true,
};

// Componente principal

export default function InventarioPage() {
  const router = useRouter();

  
}