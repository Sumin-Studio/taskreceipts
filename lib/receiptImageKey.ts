export function receiptImageKey(dataUrl: string | null | undefined): string {
  if (!dataUrl) return "no-photo";
  return `photo:${dataUrl.length}:${dataUrl.slice(0, 24)}:${dataUrl.slice(-24)}`;
}
