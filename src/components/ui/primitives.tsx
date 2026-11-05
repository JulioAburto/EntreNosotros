"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Category } from "@/types";

export function Button({ variant = "primary", className = "", onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button type="button" className={`button button-${variant} ${className}`} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onClick?.(event); }} {...props} />;
}

export function CategoryBadge({ category }: { category?: Category }) {
  return category ? <span className="category-badge"><span style={{ backgroundColor: category.color }} />{category.name}</span> : null;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return <div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div>;
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p className="muted">{children}</p>}</header>;
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content"><div className="flex items-start justify-between gap-4"><h2 id="dialog-title">{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Cerrar ventana"><X size={20} /></Button></div>{children}</div>
  </dialog>;
}

export function ConfirmDialog({ title, children, confirmLabel = "Confirmar", onConfirm, onClose }: { title: string; children: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return <Dialog title={title} onClose={onClose}><p className="muted my-5">{children}</p><div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose} data-autofocus>Cancelar</Button><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></div></Dialog>;
}
