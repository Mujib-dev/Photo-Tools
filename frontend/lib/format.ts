export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const u of units) {
    value /= 1024;
    if (value < 1024) {
      unit = u;
      break;
    }
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

export function formatPixels(w: number, h: number): string {
  return `${w} × ${h} px`;
}

export function formatFormat(fmt: string): string {
  return fmt.toUpperCase();
}
