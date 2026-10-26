"use client";

import { useCallback, useEffect, useState } from "react";
import { TIPOS_USUARIO } from "@/lib/roles";
import { useDuenoSession } from "@/hooks/useDuenoSession";
import { EMPTY_FORM, LIMITE_MAXIMO, TIPO_META, TIPOS_OPCIONES } from "@/lib/constants/usuarios";
import type { BodegaSimple, CuposDueno, CupoTipo, NuevoUsuarioForm, Toast, Usuario } from "@/lib/types/usuarios";

export function useUsuarios() {
  const usuario = useDuenoSession();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [totales, setTotales] = useState<Record<string, number> | null>(null);
  const [cuposDueno, setCuposDueno] = useState<CuposDueno | null>(null);
  const [bodegas, setBodegas] = useState<BodegaSimple[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const [editando, setEditando] = useState<Usuario | null>(null);
  const [editTipo, setEditTipo] = useState("");
  const [editBodega, setEditBodega] = useState("");
  const [editEstado, setEditEstado] = useState(true);
  const [editRequiere2fa, setEditRequiere2fa] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoForm, setNuevoForm] = useState<NuevoUsuarioForm>({ ...EMPTY_FORM });
  const [savingNuevo, setSavingNuevo] = useState(false);
  const [nuevoError, setNuevoError] = useState("");

  const [confirmToggle, setConfirmToggle] = useState<Usuario | null>(null);
  const [toggling, setToggling] = useState(false);

  const [promoviendo, setPromoviendo] = useState<Usuario | null>(null);
  const [promoPaso, setPromoPaso] = useState<"inicial" | "codigo">("inicial");
  const [promoToken, setPromoToken] = useState("");
  const [promoCodigo, setPromoCodigo] = useState("");
  const [promoCorreoEnmascarado, setPromoCorreoEnmascarado] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  const [cupos, setCupos] = useState<Record<string, CupoTipo>>({});

  const [limTipo, setLimTipo] = useState<string | null>(null);
  const [limValor, setLimValor] = useState("");
  const [limSinLimite, setLimSinLimite] = useState(false);
  const [limPaso, setLimPaso] = useState<"inicial" | "codigo">("inicial");
  const [limToken, setLimToken] = useState("");
  const [limCodigo, setLimCodigo] = useState("");
  const [limCorreoEnmascarado, setLimCorreoEnmascarado] = useState("");
  const [limLoading, setLimLoading] = useState(false);
  const [limError, setLimError] = useState("");

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const cargarCupos = useCallback(async () => {
    try {
      const r = await fetch("/api/usuarios/limites");
      const d = await r.json();
      if (r.ok) {
        const porTipo: Record<string, CupoTipo> = {};
        for (const c of (d.limites || []) as CupoTipo[]) porTipo[c.tipo_usuario] = c;
        setCupos(porTipo);
      }
    } catch {
      // Si falla, la UI sigue funcionando: el servidor igual aplica el límite.
    }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    cargarCupos();
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set("q", busqueda.trim());
      if (filtroTipo) params.set("tipo", filtroTipo);
      const r = await fetch(`/api/usuarios?${params}`);
      const d = await r.json();
      if (r.ok) {
        setUsuarios(d.usuarios || []);
        setTotales(d.totales_por_tipo ?? null);
        setCuposDueno(d.cupos_dueno ?? null);
      } else {
        showToast(d.error || "Error al cargar usuarios", "err");
      }
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setLoading(false);
    }
  }, [busqueda, filtroTipo, cargarCupos, showToast]);

  useEffect(() => {
    if (!usuario) return;
    cargar();
  }, [usuario, cargar]);

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/bodegas/simple")
      .then((r) => r.json())
      .then((d) => setBodegas(d.bodegas || []))
      .catch(() => {});
  }, [usuario]);

  const abrirEditar = (u: Usuario) => {
    setEditando(u);
    setEditTipo(u.tipo_usuario);
    setEditBodega(u.id_bodega ? String(u.id_bodega) : "");
    setEditEstado(u.estado_usuario);
    setEditRequiere2fa(u.requiere_2fa);
    setEditError("");
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    if (editTipo === TIPOS_USUARIO.BODEGUERO && !editBodega) {
      setEditError("Selecciona la bodega asignada");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const r = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: editando.id_usuario,
          tipo_usuario: editTipo,
          estado_usuario: editEstado,
          id_bodega: editTipo === TIPOS_USUARIO.BODEGUERO ? Number(editBodega) : null,
          requiere_2fa: editRequiere2fa,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setEditError(d.error || "Error al guardar");
      } else {
        setEditando(null);
        showToast("Usuario actualizado ✓", "ok");
        cargar();
      }
    } catch {
      setEditError("Error de conexión");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEstado = async (u: Usuario) => {
    setToggling(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: u.id_usuario,
          estado_usuario: !u.estado_usuario,
        }),
      });
      const d = await r.json();
      if (!r.ok) showToast(d.error || "Error", "err");
      else {
        showToast(`Cuenta ${!u.estado_usuario ? "activada" : "desactivada"} ✓`, "ok");
        cargar();
      }
    } catch {
      showToast("Error de conexión", "err");
    } finally {
      setToggling(false);
      setConfirmToggle(null);
    }
  };

  const crearUsuario = async () => {
    setNuevoError("");

    const correoTrimmed = nuevoForm.correo.trim();
    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoTrimmed);
    if (!correoValido) {
      setNuevoError("El correo no es válido. Debe incluir \"@\" y un dominio (ej: nombre@empresa.com)");
      return;
    }

    if (nuevoForm.tipo_usuario === TIPOS_USUARIO.BODEGUERO && !nuevoForm.id_bodega) {
      setNuevoError("Selecciona la bodega asignada para el bodeguero");
      return;
    }

    setSavingNuevo(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoForm),
      });
      const d = await r.json();
      if (!r.ok) {
        setNuevoError(d.error || "Error al crear usuario");
      } else {
        setModalNuevo(false);
        setNuevoForm({ ...EMPTY_FORM });
        showToast("Usuario creado ✓", "ok");
        cargar();
      }
    } catch {
      setNuevoError("Error de conexión");
    } finally {
      setSavingNuevo(false);
    }
  };

  const abrirPromover = (u: Usuario) => {
    setPromoviendo(u);
    setPromoPaso("inicial");
    setPromoToken("");
    setPromoCodigo("");
    setPromoCorreoEnmascarado("");
    setPromoError("");
  };

  const cerrarPromover = () => {
    if (promoLoading) return;
    setPromoviendo(null);
  };

  const solicitarPromocion = async () => {
    if (!promoviendo) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const r = await fetch("/api/usuarios/promover-dueno/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: promoviendo.id_usuario }),
      });
      const d = await r.json();
      if (!r.ok) {
        setPromoError(d.error || "No se pudo enviar el código de confirmación");
      } else {
        setPromoToken(d.token);
        setPromoCorreoEnmascarado(d.correo_enmascarado || "");
        setPromoPaso("codigo");
      }
    } catch {
      setPromoError("Error de conexión");
    } finally {
      setPromoLoading(false);
    }
  };

  const confirmarPromocion = async () => {
    if (!promoviendo) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const r = await fetch("/api/usuarios/promover-dueno/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: promoToken, codigo: promoCodigo }),
      });
      const d = await r.json();
      if (!r.ok) {
        setPromoError(d.error || "Código incorrecto");
      } else {
        const nombrePromovido = promoviendo.nombre;
        setPromoviendo(null);
        showToast(`${nombrePromovido} ahora es dueño ✓`, "ok");
        cargar();
      }
    } catch {
      setPromoError("Error de conexión");
    } finally {
      setPromoLoading(false);
    }
  };

  const cupoLleno = (tipo: string): boolean => {
    const c = cupos[tipo];
    return !!c && c.limite !== null && c.activos >= c.limite;
  };

  const textoLimite = (tipo: string): string => {
    const c = cupos[tipo];
    if (!c) return "…";
    return c.limite === null ? "Sin límite" : `Límite ${c.limite}`;
  };

  const abrirLimite = (tipo: string) => {
    const c = cupos[tipo];
    setLimTipo(tipo);
    setLimValor(c && c.limite !== null ? String(c.limite) : "");
    setLimSinLimite(!!c && c.limite === null);
    setLimPaso("inicial");
    setLimToken("");
    setLimCodigo("");
    setLimCorreoEnmascarado("");
    setLimError("");
  };

  const cerrarLimite = () => {
    if (limLoading) return;
    setLimTipo(null);
  };

  const solicitarCambioLimite = async () => {
    if (!limTipo) return;
    const minimo = Math.max(1, cupos[limTipo]?.activos ?? 1);
    const valor = Number(limValor);
    if (!limSinLimite) {
      if (!Number.isInteger(valor) || valor < minimo || valor > LIMITE_MAXIMO) {
        setLimError(
          `Ingresa un número entero entre ${minimo} y ${LIMITE_MAXIMO} (no puede ser menor que los usuarios activos).`
        );
        return;
      }
    }
    setLimLoading(true);
    setLimError("");
    try {
      const r = await fetch("/api/usuarios/limites/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_usuario: limTipo, max_usuarios: limSinLimite ? null : valor }),
      });
      const d = await r.json();
      if (!r.ok) {
        setLimError(d.error || "No se pudo enviar el código de confirmación");
      } else {
        setLimToken(d.token);
        setLimCorreoEnmascarado(d.correo_enmascarado || "");
        setLimPaso("codigo");
      }
    } catch {
      setLimError("Error de conexión");
    } finally {
      setLimLoading(false);
    }
  };

  const confirmarCambioLimite = async () => {
    if (!limTipo) return;
    setLimLoading(true);
    setLimError("");
    try {
      const r = await fetch("/api/usuarios/limites/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: limToken, codigo: limCodigo }),
      });
      const d = await r.json();
      if (!r.ok) {
        setLimError(d.error || "Código incorrecto");
      } else {
        const label = TIPO_META[limTipo]?.label ?? limTipo;
        setLimTipo(null);
        showToast(`Límite de ${label.toLowerCase()} actualizado ✓`, "ok");
        cargar();
      }
    } catch {
      setLimError("Error de conexión");
    } finally {
      setLimLoading(false);
    }
  };

  const correoNuevoValido =
    nuevoForm.correo.trim() === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoForm.correo.trim());
  const correoNuevoCompleto = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoForm.correo.trim());

  const totalPorTipo = TIPOS_OPCIONES.slice(1).map((t) => ({
    ...t,
    count: totales?.[t.value] ?? usuarios.filter((u) => u.tipo_usuario === t.value).length,
  }));

  const cupoDuenoActual = cupos[TIPOS_USUARIO.DUENO];
  const limiteDuenos = cupoDuenoActual ? cupoDuenoActual.limite : cuposDueno?.maximo ?? null;
  const duenosUsados = cupoDuenoActual?.activos ?? cuposDueno?.usados ?? 0;
  const limiteDuenosAlcanzado = limiteDuenos !== null && duenosUsados >= limiteDuenos;
  const cuposResumen = limiteDuenos === null
    ? "Sin límite de dueños activos"
    : limiteDuenosAlcanzado
      ? `Sin cupos de dueño (${duenosUsados} de ${limiteDuenos} en uso)`
      : `${Math.max(0, limiteDuenos - duenosUsados)} de ${limiteDuenos} cupos de dueño disponibles`;

  return {
    usuario,
    usuarios,
    loading,
    cargar,
    bodegas,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    totalPorTipo,
    cupos,
    cuposDueno,
    cuposResumen,
    cupoDuenoActual,
    limiteDuenos,
    limiteDuenosAlcanzado,
    cupoLleno,
    textoLimite,
    modalNuevo,
    setModalNuevo,
    nuevoForm,
    setNuevoForm,
    savingNuevo,
    nuevoError,
    crearUsuario,
    correoNuevoValido,
    correoNuevoCompleto,
    editando,
    setEditando,
    editTipo,
    setEditTipo,
    editBodega,
    setEditBodega,
    editEstado,
    setEditEstado,
    editRequiere2fa,
    setEditRequiere2fa,
    savingEdit,
    editError,
    abrirEditar,
    guardarEdicion,
    confirmToggle,
    setConfirmToggle,
    toggling,
    toggleEstado,
    promoviendo,
    promoPaso,
    setPromoCodigo,
    promoCorreoEnmascarado,
    promoCodigo,
    promoLoading,
    promoError,
    abrirPromover,
    cerrarPromover,
    solicitarPromocion,
    confirmarPromocion,
    limTipo,
    limValor,
    setLimValor,
    limSinLimite,
    setLimSinLimite,
    limPaso,
    limCodigo,
    setLimCodigo,
    limCorreoEnmascarado,
    limLoading,
    limError,
    abrirLimite,
    cerrarLimite,
    solicitarCambioLimite,
    confirmarCambioLimite,
    toast,
  };
}

export type UsuariosController = ReturnType<typeof useUsuarios>;
