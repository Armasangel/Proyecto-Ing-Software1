"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// Tipos 
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

  const [usuario,    setUsuario]    = useState<Usuario | null>(null);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas,     setMarcas]     = useState<Marca[]>([]);

  const [busqueda,   setBusqueda]   = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  // Modal
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editando,   setEditando]   = useState<Producto | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");

  // Confirm delete
  const [confirmId,  setConfirmId]  = useState<number | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  // Carga inicial 
  const cargarProductos = useCallback(() => {
    fetch("/api/productos")
      .then(r => r.json())
      .then(d => setProductos(d.productos || []));
  }, []);

  useEffect(() => {
    fetch("/api/sesion")
      .then(r => r.json())
      .then(d => {
        if (!d.usuario) { router.replace("/login"); return; }
        setUsuario(d.usuario);
      });

    cargarProductos();

    fetch("/api/categorias").then(r => r.json()).then(d => setCategorias(d.categorias || []));
    fetch("/api/marcas").then(r => r.json()).then(d => setMarcas(d.marcas || []));
  }, [router, cargarProductos]);

  // Toast helper 
  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // Modal helpers 
  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  const abrirEditar = (p: Producto) => {
    setEditando(p);
    setForm({
      codigo_producto: p.codigo_producto,
      nombre_producto: p.nombre_producto,
      precio_unitario: p.precio_unitario ?? "",
      precio_mayoreo:  p.precio_mayoreo  ?? "",
      unidad_medida:   p.unidad_medida,
      id_categoria:    String(p.id_categoria),
      id_marca:        String(p.id_marca),
      caducidad:       p.caducidad,
      exento_iva:      p.exento_iva,
      estado_producto: p.estado_producto,
    });
    setFormError("");
    setModalOpen(true);
  };

  const cerrarModal = () => { setModalOpen(false); setEditando(null); };

  // Guardar (crear o editar) 
  const handleGuardar = async () => {
    if (!form.codigo_producto || !form.nombre_producto || !form.unidad_medida ||
        !form.id_categoria || !form.id_marca) {
      setFormError("Completa todos los campos obligatorios (*)");
      return;
    }

    setSaving(true);
    setFormError("");

    const url    = editando ? `/api/productos/${editando.id_producto}` : "/api/productos";
    const method = editando ? "PUT" : "POST";

    const payload = {
      ...form,
      precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
      precio_mayoreo:  form.precio_mayoreo  ? Number(form.precio_mayoreo)  : null,
      id_categoria:    Number(form.id_categoria),
      id_marca:        Number(form.id_marca),
    };

    try {
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Error al guardar");
      } else {
        cerrarModal();
        cargarProductos();
        showToast(editando ? "Producto actualizado ✓" : "Producto creado ✓", "ok");
      }
    } catch {
      setFormError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  // Eliminar
  const handleEliminar = async (id: number) => {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/productos/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Error al eliminar", "err");
      } else if (data.desactivado) {
        showToast("Producto desactivado (tiene historial)", "ok");
        cargarProductos();
      } else {
        showToast("Producto eliminado ✓", "ok");
        cargarProductos();
      }
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  };

  // Filtros 
  if (!usuario) {
    return <div style={{ padding: "2rem", color: "var(--muted)", fontFamily: "var(--font-body)" }}>Cargando…</div>;
  }

  const esDueno    = usuario.tipo_usuario === "DUENO";
  const verPrecios = esDueno || usuario.tipo_usuario === "EMPLEADO";

  const productosFiltrados = productos.filter(p => {
    if (soloActivos && !p.estado_producto) return false;
    const q = busqueda.toLowerCase();
    return (
      p.nombre_producto.toLowerCase().includes(q) ||
      p.codigo_producto.toLowerCase().includes(q) ||
      p.nombre_categoria.toLowerCase().includes(q) ||
      p.nombre_marca.toLowerCase().includes(q)
    );
  });

}