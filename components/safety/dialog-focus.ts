"use client";

import { useEffect, type RefObject } from "react";
import { nextDialogFocusIndex } from "../connections/dialog-focus";

export function nextSafetyDialogFocusIndex(currentIndex: number, count: number, reverse: boolean): number {
  return nextDialogFocusIndex(currentIndex, count, reverse);
}

export function shouldCloseSafetyDialog(key: string): boolean {
  return key === "Escape";
}

export function safetyDialogSuccessState(result: "blocked" | "reported") {
  return { open: false as const, focusTarget: "status" as const, result };
}

export function useSafetyDialogFocus(
  open: boolean,
  onClose: () => void,
  dialogRef: RefObject<HTMLElement | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => initialFocusRef.current?.focus());
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (shouldCloseSafetyDialog(event.key)) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      ) ?? []).filter((element) => element.offsetParent !== null);
      const target = nextSafetyDialogFocusIndex(
        focusable.indexOf(document.activeElement as HTMLElement),
        focusable.length,
        event.shiftKey,
      );
      if (target >= 0) {
        event.preventDefault();
        focusable[target]?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogRef, onClose, open]);
}
