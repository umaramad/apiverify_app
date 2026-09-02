/**
 * Pure local log window reader — fs only, no Electron.
 *
 * Windowed head/tail reads keep large logs thin. UTF-8 boundaries are aligned
 * at both ends of a truncated window so an edge never renders a partial
 * character, and short reads (file resized mid-read) never pad with NUL bytes.
 */
import fs from 'fs'
import path from 'path'
import {
  DEFAULT_LOCAL_LOG_WINDOW_BYTES,
  MAX_LOCAL_LOG_FILE_BYTES,
  type LocalLogFileContent,
  type LocalLogReadMode,
  type LocalLogReadOptions,
} from '../models/localLogViewer'
import { formatDiskSize, formatMb } from '../../../shared/utils/format'

export const MIN_LOCAL_LOG_WINDOW_BYTES = 1024 * 1024

function makeId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Clamp a requested window size to [MIN_LOCAL_LOG_WINDOW_BYTES, MAX_LOCAL_LOG_FILE_BYTES]. */
export function clampWindowBytes(requested?: number): number {
  const n =
    typeof requested === 'number' && Number.isFinite(requested)
      ? Math.floor(requested)
      : DEFAULT_LOCAL_LOG_WINDOW_BYTES
  return Math.min(MAX_LOCAL_LOG_FILE_BYTES, Math.max(MIN_LOCAL_LOG_WINDOW_BYTES, n))
}

function resolveReadOptions(opts?: LocalLogReadOptions): {
  mode: LocalLogReadMode
  windowBytes: number
} {
  const mode: LocalLogReadMode = opts?.mode === 'head' ? 'head' : 'tail'
  return { mode, windowBytes: clampWindowBytes(opts?.windowBytes) }
}

/** Advance past a partial UTF-8 sequence at the start of a mid-file slice. */
export function alignUtf8Start(buf: Buffer): Buffer {
  if (buf.length === 0) return buf
  let i = 0
  // Skip continuation bytes (10xxxxxx) at the front — incomplete leading char.
  while (i < buf.length && i < 4 && (buf[i] & 0xc0) === 0x80) i += 1
  return i === 0 ? buf : buf.subarray(i)
}

/** Trim a partial UTF-8 sequence at the end of a mid-file slice. */
export function alignUtf8End(buf: Buffer): Buffer {
  if (buf.length === 0) return buf
  let i = buf.length - 1
  // Walk back over continuation bytes to find the last lead byte.
  while (i >= 0 && (buf[i] & 0xc0) === 0x80) i -= 1
  if (i < 0) return buf // all continuation bytes — nothing sane to trim
  const lead = buf[i]
  if ((lead & 0x80) === 0) return buf // ASCII — boundary is clean
  // Lead byte is 0xC0–0xFF here: continuation bytes were skipped and ASCII returned above.
  const expected = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : 2
  const have = buf.length - i
  return have >= expected ? buf : buf.subarray(0, i)
}

export function readLocalLogWindow(
  filePath: string,
  opts?: LocalLogReadOptions
): LocalLogFileContent {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`)
  }
  const stats = fs.statSync(resolved)
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${resolved}`)
  }

  const { mode, windowBytes } = resolveReadOptions(opts)
  const truncated = stats.size > windowBytes
  const toRead = Math.min(stats.size, windowBytes)
  const startOffset = mode === 'tail' && truncated ? stats.size - toRead : 0

  const fd = fs.openSync(resolved, 'r')
  try {
    const buf = Buffer.alloc(toRead)
    const bytesRead = fs.readSync(fd, buf, 0, toRead, startOffset)
    let window: Buffer = buf.subarray(0, bytesRead)

    if (truncated) {
      if (startOffset > 0) window = alignUtf8Start(window)
      window = alignUtf8End(window)
    }

    let content = window.toString('utf8')

    if (truncated) {
      const sliceLabel =
        mode === 'tail'
          ? `last ${formatMb(windowBytes)} MB (from end)`
          : `first ${formatMb(windowBytes)} MB (from start)`
      content =
        `[Local Log Viewer] Showing ${sliceLabel} of ${path.basename(resolved)} ` +
        `(${formatDiskSize(stats.size)} on disk). Change Head/Tail or window size, then Reload.\n\n` +
        (mode === 'tail' ? '…\n' : '') +
        content +
        (mode === 'head' ? '\n…' : '')
    }

    return {
      id: makeId(),
      filePath: resolved,
      fileName: path.basename(resolved),
      content,
      byteSize: stats.size,
      truncated,
      readMode: mode,
      windowBytes,
    }
  } finally {
    fs.closeSync(fd)
  }
}
