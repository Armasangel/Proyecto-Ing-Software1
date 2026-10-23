"use client";

import type { ReactNode } from "react";

export const inputCls =
  "w-full px-3 py-2 rounded-control border border-[var(--border)] bg-cream/60 text-ink text-sm outline-none focus:ring-2 focus:ring-market/40 disabled:opacity-60";

export const primaryBtnCls =
  "px-4 py-2 rounded-control bg-market text-white border-none font-semibold text-sm transition-transform active:scale-[0.97] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed";

export const secondaryBtnCls =
  "px-4 py-2 rounded-control bg-cream-100 border border-[var(--border)] text-ink-muted text-sm hover:bg-[var(--border)]/40 disabled:opacity-60";

export function Campo({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1 text-[0.82rem] font-semibold text-ink-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[0.75rem] text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Mensaje({ tipo, children }: { tipo: "ok" | "error"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-control border px-3 py-2 text-[0.85rem] ${
        tipo === "ok"
          ? "border-market/30 bg-market-50 text-market-600"
          : "border-red-300 bg-red-50 text-red-700"
      }`}
    >
      {children}
    </p>
  );
}
