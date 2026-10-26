"use client";

import { useState, type FormEvent } from "react";
import { ETIQUETAS_TIPO_CLIENTE, TIPOS_CLIENTE } from "@/lib/tipos-cliente";
import { Campo, Mensaje, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/form";
import { crearCliente } from "@/lib/clientes-api";
import {
  CLIENTE_FORM_VACIO,
  CODIGO_CLIENTE_MAX,
  CODIGO_POSTAL_MAX,
  DIRECCION_MAX,
  NIT_MAX,
  validarClienteForm,
  type ClienteCreado,
  type ClienteFormValues,
} from "@/lib/clientes-form";

type FormularioClienteProps = {
  variant?: "page" | "inline";
  correoObligatorio?: boolean;
  validarFormatoCorreo?: boolean;
  incluirSaldoAnterior?: boolean;
  onCreado?: (
    cliente: ClienteCreado,
    meta: { deudaInicial: number | null }
  ) => void | Promise<void>;
  onCancelar?: () => void;
  textoBoton?: string;
  className?: string;
};

export function FormularioCliente({
  variant = "page",
  correoObligatorio = false,
  validarFormatoCorreo = false,
  incluirSaldoAnterior = false,
  onCreado,
  onCancelar,
  textoBoton = "Crear cliente",
  className,
}: FormularioClienteProps) {
  const [form, setForm] = useState<ClienteFormValues>({ ...CLIENTE_FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const set = (campo: keyof ClienteFormValues, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");

    const validado = validarClienteForm(form, {
      correoObligatorio,
      validarFormatoCorreo,
      incluirSaldoAnterior,
      mensajeNombre:
        variant === "inline"
          ? "El nombre del cliente nuevo es obligatorio"
          : "El nombre del cliente es obligatorio",
    });
    if (!validado.ok) {
      setError(validado.error);
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearCliente(validado.payload);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setForm({ ...CLIENTE_FORM_VACIO });
      if (onCreado) {
        await onCreado(resultado.cliente, { deudaInicial: validado.deudaInicial });
      } else {
        setOk(`Cliente «${validado.payload.nombre}» creado.`);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  if (variant === "inline") {
    return (
      <form onSubmit={guardar} noValidate className={className}>
        <div className="flex flex-col gap-2.5 p-3 border border-dashed border-[var(--border)] rounded-control">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo label="Nombre" required>
              <input
                className={inputCls}
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Nombre del cliente"
              />
            </Campo>
            <Campo label="Teléfono">
              <input
                className={inputCls}
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="Opcional"
              />
            </Campo>
            <Campo label="Correo" required={correoObligatorio}>
              <input
                type="email"
                className={inputCls}
                value={form.correo}
                onChange={(e) => set("correo", e.target.value)}
                placeholder="nombre@correo.com"
              />
            </Campo>
            <Campo label="Tipo de cliente">
              <select
                className={inputCls}
                value={form.tipo_cliente}
                onChange={(e) => set("tipo_cliente", e.target.value)}
              >
                {TIPOS_CLIENTE.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ETIQUETAS_TIPO_CLIENTE[tipo]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="NIT (opcional)">
              <input
                className={inputCls}
                aria-label="NIT del cliente"
                value={form.nit_cliente}
                onChange={(e) => set("nit_cliente", e.target.value)}
                placeholder="Ej. 1234567-8 · vacío = CF"
                maxLength={NIT_MAX}
              />
            </Campo>
            <Campo label="Código postal">
              <input
                className={inputCls}
                aria-label="Código postal del cliente"
                value={form.codigo_postal}
                onChange={(e) => set("codigo_postal", e.target.value)}
                placeholder="Ej. 01001"
                maxLength={CODIGO_POSTAL_MAX}
              />
            </Campo>
            <Campo label="Código de cliente">
              <input
                className={inputCls}
                aria-label="Código del cliente"
                value={form.codigo_cliente}
                onChange={(e) => set("codigo_cliente", e.target.value)}
                placeholder="Vacío = se genera solo"
                maxLength={CODIGO_CLIENTE_MAX}
              />
            </Campo>
          </div>

          <Campo label="Dirección">
            <input
              className={inputCls}
              aria-label="Dirección del cliente"
              value={form.direccion}
              onChange={(e) => set("direccion", e.target.value)}
              placeholder="Calle, zona, municipio (opcional)"
              maxLength={DIRECCION_MAX}
            />
          </Campo>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo label="Límite de crédito (opcional)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={form.limite_deuda}
                onChange={(e) => set("limite_deuda", e.target.value)}
                placeholder="Sin límite"
              />
            </Campo>
            {incluirSaldoAnterior && (
              <Campo label="Saldo anterior" hint="Opcional. Se registra como deuda inicial.">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  aria-label="Saldo anterior"
                  value={form.deuda_inicial}
                  onChange={(e) => set("deuda_inicial", e.target.value)}
                  placeholder="Q0.00"
                />
              </Campo>
            )}
          </div>

          {incluirSaldoAnterior && (
            <p className="text-[0.75rem] text-ink-muted">
              Si ya te debía algo se registra de una vez como saldo por cobrar — y si eso ya supera el
              límite que le pongas, queda bloqueado desde ya.
            </p>
          )}

          <Mensaje tipo="error">{error}</Mensaje>

          <div className="flex gap-2">
            <button type="submit" className={primaryBtnCls} disabled={guardando}>
              {guardando ? "Creando…" : textoBoton}
            </button>
            {onCancelar && (
              <button type="button" className={secondaryBtnCls} onClick={onCancelar} disabled={guardando}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={guardar} noValidate className={`grid gap-4 ${className ?? ""}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" required>
          <input
            className={inputCls}
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Nombre completo o razón social"
          />
        </Campo>
        <Campo label="Correo">
          <input
            className={inputCls}
            type="email"
            value={form.correo}
            onChange={(e) => set("correo", e.target.value)}
            placeholder="cliente@correo.com"
          />
        </Campo>
        <Campo label="Teléfono">
          <input
            className={inputCls}
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder="5555-5555"
          />
        </Campo>
        <Campo label="Tipo de cliente">
          <select
            className={inputCls}
            value={form.tipo_cliente}
            onChange={(e) => set("tipo_cliente", e.target.value)}
          >
            {TIPOS_CLIENTE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_TIPO_CLIENTE[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="NIT" hint="Se usa en la factura cambiaria. Sin NIT se guarda CF.">
          <input
            className={inputCls}
            value={form.nit_cliente}
            onChange={(e) => set("nit_cliente", e.target.value)}
            placeholder="1234567-8"
            maxLength={NIT_MAX}
          />
        </Campo>
        <Campo label="Código de cliente" hint="Si se deja vacío se genera CLI-00001, CLI-00002…">
          <input
            className={inputCls}
            value={form.codigo_cliente}
            onChange={(e) => set("codigo_cliente", e.target.value)}
            placeholder="CLI-00001"
            maxLength={CODIGO_CLIENTE_MAX}
          />
        </Campo>
        <Campo label="Límite de crédito">
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            value={form.limite_deuda}
            onChange={(e) => set("limite_deuda", e.target.value)}
            placeholder="0.00"
          />
        </Campo>
        <Campo label="Código postal">
          <input
            className={inputCls}
            value={form.codigo_postal}
            onChange={(e) => set("codigo_postal", e.target.value)}
            placeholder="01001"
            maxLength={CODIGO_POSTAL_MAX}
          />
        </Campo>
        {incluirSaldoAnterior && (
          <Campo label="Saldo anterior" hint="Opcional. Se registra como deuda inicial.">
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              value={form.deuda_inicial}
              onChange={(e) => set("deuda_inicial", e.target.value)}
              placeholder="0.00"
            />
          </Campo>
        )}
      </div>
      <Campo label="Dirección">
        <input
          className={inputCls}
          value={form.direccion}
          onChange={(e) => set("direccion", e.target.value)}
          placeholder="6a. avenida 12-34, zona 1"
          maxLength={DIRECCION_MAX}
        />
      </Campo>
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="ok">{ok}</Mensaje>
      <div>
        <button type="submit" className={primaryBtnCls} disabled={guardando}>
          {guardando ? "Creando…" : textoBoton}
        </button>
      </div>
    </form>
  );
}
