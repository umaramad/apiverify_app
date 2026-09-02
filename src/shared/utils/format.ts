/** Byte-size formatting shared by main-process readers and renderer UI. */

export function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)
}

export function formatDiskSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${formatMb(bytes)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}
