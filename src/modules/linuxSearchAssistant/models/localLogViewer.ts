/** Local Log Viewer — lightweight multi-tab log reader (reuses LSA output panel). */

export const LOCAL_LOG_VIEWER_PAGE_ID = 'localLogViewer' as const

export type LocalLogViewerPageId = typeof LOCAL_LOG_VIEWER_PAGE_ID

/** How to slice oversized files — tail is usually what you want for live logs. */
export type LocalLogReadMode = 'head' | 'tail'

/** Default window when opening / reloading (covers typical ~20MB logs fully). */
export const DEFAULT_LOCAL_LOG_WINDOW_BYTES = 20 * 1024 * 1024

/** Hard cap per tab so multi-tab viewing stays memory-light. */
export const MAX_LOCAL_LOG_FILE_BYTES = 32 * 1024 * 1024

export const LOCAL_LOG_WINDOW_PRESETS_MB = [10, 20, 32] as const

export const MAX_LOCAL_LOG_OPEN_FILES = 12

export interface LocalLogReadOptions {
  mode?: LocalLogReadMode
  /** Bytes to load from head or tail (clamped to MAX_LOCAL_LOG_FILE_BYTES). */
  windowBytes?: number
}

export interface LocalLogFileContent {
  id: string
  filePath: string
  fileName: string
  content: string
  byteSize: number
  /** True when disk file is larger than the loaded window. */
  truncated: boolean
  readMode: LocalLogReadMode
  windowBytes: number
}

export type OpenLocalLogFilesResult =
  | { canceled: true }
  | {
      canceled: false
      files: LocalLogFileContent[]
      skipped: Array<{ filePath: string; reason: string }>
    }
