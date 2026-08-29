export function nextDialogFocusIndex(currentIndex: number, count: number, reverse: boolean): number {
  if (count < 1) return -1;
  if (currentIndex < 0) return reverse ? count - 1 : 0;
  return reverse ? (currentIndex - 1 + count) % count : (currentIndex + 1) % count;
}

export function shouldCloseConnectionDialog(key: string): boolean {
  return key === "Escape";
}
