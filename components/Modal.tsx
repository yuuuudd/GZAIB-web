"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

// Native top-layer dialogs escape ancestor clipping and manage nested focus/Escape.
export function Modal({ children, className = "connection-dialog-backdrop", labelledBy, describedBy, role = "dialog", onDismiss }: {
  children: ReactNode;
  className?: string;
  labelledBy: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  onDismiss(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Native dialog provides keyboard dismissal; this also dismisses a backdrop tap.
  return <dialog ref={ref} className={`modal-frame ${className}`} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onDismiss(); }}
    onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    {children}
  </dialog>;
}
